import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VocabularyItem {
  word: string;
  definition: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

interface GrammarItem {
  rule: string;
  example: string;
  explanation: string;
}

interface AnalysisResult {
  vocabulary: VocabularyItem[];
  grammar: GrammarItem[];
  detectedLanguage: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate input
    const requestSchema = z.object({
      transcript: z.string().min(50, 'Transcript too short').max(50000, 'Transcript too long (max 50,000 characters)')
    });

    const { transcript } = requestSchema.parse(await req.json());

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    console.log('Analyzing content with Gemini 2.0 Flash, transcript length:', transcript.length);

    // Define the schema for structured output
    const responseSchema = {
      type: "object",
      properties: {
        detectedLanguage: { type: "string", description: "The detected language of the text (e.g., Japanese, Chinese, Korean)." },
        vocabulary: {
          type: "array",
          items: {
            type: "object",
            properties: {
              word: { type: "string", description: "The vocabulary word in the original language." },
              definition: { type: "string", description: "Clear definition in English." },
              difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"], description: "Difficulty level." }
            },
            required: ["word", "definition", "difficulty"]
          }
        },
        grammar: {
          type: "array",
          items: {
            type: "object",
            properties: {
              rule: { type: "string", description: "Grammar rule name in the original language." },
              example: { type: "string", description: "Example from the text in the original language." },
              explanation: { type: "string", description: "Clear explanation in English." }
            },
            required: ["rule", "example", "explanation"]
          }
        }
      },
      required: ["detectedLanguage", "vocabulary", "grammar"]
    };

    // Use Gemini 2.0 Flash to analyze the content (faster and more reliable)
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + geminiApiKey, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a language learning assistant. Analyze the provided text sentence by sentence to extract key vocabulary and grammar patterns.

CRITICAL INSTRUCTIONS:
1. **Sentence-by-Sentence Analysis**: Go through the text sentence by sentence. For each sentence, identify important vocabulary and grammar structures.
2. **Deduplication**: Consolidate your findings. Ensure there are NO duplicate vocabulary words or grammar rules in the final output. If a word or rule appears multiple times, keep only the most representative instance.
3. **Language Detection**: Accurately detect the language (Japanese, Chinese, Korean, etc.) based on characters and particles.
4. **Output Format**: You must return the result in the specified JSON format.

Analyze this text:
${transcript.slice(0, 10000)}` // Increased limit for Gemini's larger context window
          }]
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: responseSchema,
          temperature: 0.7 // Balanced for accuracy and creativity
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();

    // Parse Gemini response
    // Gemini 3 with structured output returns the JSON string in the text field
    const contentText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!contentText) {
      throw new Error('No response content from Gemini');
    }

    console.log('Gemini response received, parsing...');

    let result: AnalysisResult;
    try {
      result = JSON.parse(contentText);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', contentText);
      throw new Error('Failed to parse Gemini response');
    }

    // Validate and sanitize the result (extra safety)
    if (!result.vocabulary || !Array.isArray(result.vocabulary)) {
      result.vocabulary = [];
    }
    if (!result.grammar || !Array.isArray(result.grammar)) {
      result.grammar = [];
    }
    if (!result.detectedLanguage) {
      result.detectedLanguage = 'Unknown';
    }

    console.log('Analysis complete:', {
      language: result.detectedLanguage,
      vocabCount: result.vocabulary.length,
      grammarCount: result.grammar.length
    });

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in analyze-content function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        detectedLanguage: 'Unknown',
        vocabulary: [],
        grammar: []
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
