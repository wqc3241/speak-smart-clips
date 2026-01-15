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
  difficulty?: string;
}

interface GrammarItem {
  rule: string;
  example: string;
  explanation: string;
}

interface PracticeSentence {
  text: string;
  translation: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  usedVocabulary: string[];
  usedGrammar: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate input
    const vocabularySchema = z.object({
      word: z.string().max(100),
      definition: z.string().max(500),
      difficulty: z.string().optional()
    });

    const grammarSchema = z.object({
      rule: z.string().max(200),
      example: z.string().max(500),
      explanation: z.string().max(1000)
    });

    const requestSchema = z.object({
      vocabulary: z.array(vocabularySchema).min(1, 'At least one vocabulary item required').max(100, 'Maximum 100 vocabulary items'),
      grammar: z.array(grammarSchema).min(1, 'At least one grammar item required').max(50, 'Maximum 50 grammar items'),
      detectedLanguage: z.string().max(50),
      count: z.number().int().min(1).max(20).default(10)
    });

    const { vocabulary, grammar, detectedLanguage, count } = requestSchema.parse(await req.json());

    console.log('Generating practice sentences for:', detectedLanguage);
    console.log('Vocabulary count:', vocabulary.length);
    console.log('Grammar count:', grammar.length);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const vocabularyWords = vocabulary.map((v) => v.word).join(', ');
    const grammarRules = grammar.map((g) => g.rule).join('; ');

    const systemPrompt = `You are a language learning expert. Generate practice sentences that help students apply vocabulary and grammar in context. Use the generate_sentences function to return the structured result.`;

    const userPrompt = `Generate ${count} practice sentences in ${detectedLanguage} for language learners.

Vocabulary words to use: ${vocabularyWords}

Grammar patterns to demonstrate: ${grammarRules}

Requirements:
1. Each sentence should use 1-3 vocabulary words from the list
2. Each sentence should demonstrate at least 1 grammar pattern
3. Mix difficulty levels: some beginner, some intermediate, some advanced
4. Make sentences natural, conversational, and useful for real-world communication
5. Sentences should be practical and relevant to everyday situations`;

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
          { role: 'user', content: userPrompt }
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_sentences",
            description: "Generate practice sentences for language learning",
            parameters: {
              type: "object",
              properties: {
                sentences: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      text: { type: "string", description: "The sentence in the target language" },
                      translation: { type: "string", description: "English translation" },
                      difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
                      usedVocabulary: { 
                        type: "array", 
                        items: { type: "string" },
                        description: "List of vocabulary words used in this sentence"
                      },
                      usedGrammar: { 
                        type: "array", 
                        items: { type: "string" },
                        description: "List of grammar rules demonstrated in this sentence"
                      }
                    },
                    required: ["text", "translation", "difficulty", "usedVocabulary", "usedGrammar"],
                    additionalProperties: false
                  }
                }
              },
              required: ["sentences"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "generate_sentences" } }
      }),
    });

    // Handle rate limiting
    if (response.status === 429) {
      console.error('AI Gateway rate limit exceeded');
      return new Response(
        JSON.stringify({ 
          error: 'Rate limits exceeded, please try again later.',
          sentences: []
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (response.status === 402) {
      console.error('AI credits exhausted');
      return new Response(
        JSON.stringify({ 
          error: 'AI credits exhausted. Please add credits to your workspace.',
          sentences: []
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
    console.log('AI Gateway response received');

    // Parse tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'generate_sentences') {
      throw new Error('No valid tool call response from AI');
    }

    let result;
    try {
      result = JSON.parse(toolCall.function.arguments);
    } catch (parseError: any) {
      console.error('JSON parse error:', parseError.message);
      console.error('Failed to parse text:', toolCall.function.arguments);
      throw new Error(`Failed to parse AI response: ${parseError.message}`);
    }

    console.log('Generated sentences:', result.sentences?.length || 0);

    return new Response(
      JSON.stringify(result), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in generate-practice-sentences:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        sentences: []
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
