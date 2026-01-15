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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Analyzing content with Lovable AI Gateway, transcript length:', transcript.length);

    const systemPrompt = `You are a language learning assistant. Analyze the provided text sentence by sentence to extract key vocabulary and grammar patterns.

CRITICAL INSTRUCTIONS:
1. **Sentence-by-Sentence Analysis**: Go through the text sentence by sentence. For each sentence, identify important vocabulary and grammar structures.
2. **Deduplication**: Consolidate your findings. Ensure there are NO duplicate vocabulary words or grammar rules in the final output. If a word or rule appears multiple times, keep only the most representative instance.
3. **Language Detection**: Accurately detect the language (Japanese, Chinese, Korean, etc.) based on characters and particles.
4. **Output Format**: Use the analyze_content function to return the structured result.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this text:\n${transcript.slice(0, 10000)}` }
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyze_content",
            description: "Extract vocabulary, grammar, and detected language from text",
            parameters: {
              type: "object",
              properties: {
                detectedLanguage: { 
                  type: "string",
                  description: "The detected language of the text (e.g., Japanese, Chinese, Korean)"
                },
                vocabulary: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      word: { type: "string", description: "The vocabulary word in the original language" },
                      definition: { type: "string", description: "Clear definition in English" },
                      difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"], description: "Difficulty level" }
                    },
                    required: ["word", "definition", "difficulty"],
                    additionalProperties: false
                  }
                },
                grammar: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      rule: { type: "string", description: "Grammar rule name in the original language" },
                      example: { type: "string", description: "Example from the text in the original language" },
                      explanation: { type: "string", description: "Clear explanation in English" }
                    },
                    required: ["rule", "example", "explanation"],
                    additionalProperties: false
                  }
                }
              },
              required: ["detectedLanguage", "vocabulary", "grammar"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "analyze_content" } }
      }),
    });

    // Handle rate limiting
    if (response.status === 429) {
      console.error('AI Gateway rate limit exceeded');
      return new Response(
        JSON.stringify({ 
          error: 'Rate limits exceeded, please try again later.',
          vocabulary: [],
          grammar: [],
          detectedLanguage: 'Unknown'
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (response.status === 402) {
      console.error('AI credits exhausted');
      return new Response(
        JSON.stringify({ 
          error: 'AI credits exhausted. Please add credits to your workspace.',
          vocabulary: [],
          grammar: [],
          detectedLanguage: 'Unknown'
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();

    // Parse tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'analyze_content') {
      throw new Error('No valid tool call response from AI');
    }

    let result: AnalysisResult;
    try {
      result = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error('Failed to parse AI response:', toolCall.function.arguments);
      throw new Error('Failed to parse AI response');
    }

    // Validate and sanitize the result
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
