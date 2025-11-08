import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { transcript } = await req.json();
    
    if (!transcript || transcript.trim().length === 0) {
      throw new Error('Transcript is required');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    console.log('Analyzing content with AI, transcript length:', transcript.length);

    // Use OpenAI to analyze the content in any language
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a language learning assistant. Analyze the provided text and extract:
1. 15 key vocabulary words with definitions and difficulty levels (beginner/intermediate/advanced)
2. 5 important grammar patterns with examples from the text and explanations
3. The language of the text

Return ONLY valid JSON in this exact format:
{
  "detectedLanguage": "language name",
  "vocabulary": [
    {
      "word": "word",
      "definition": "clear definition in the same language",
      "difficulty": "beginner|intermediate|advanced"
    }
  ],
  "grammar": [
    {
      "rule": "grammar rule name",
      "example": "example from the text",
      "explanation": "clear explanation in the same language"
    }
  ]
}`
          },
          {
            role: 'user',
            content: `Analyze this text:\n\n${transcript.slice(0, 3000)}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from OpenAI');
    }

    console.log('AI response received, parsing...');

    // Parse the JSON response
    let result: AnalysisResult;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
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
