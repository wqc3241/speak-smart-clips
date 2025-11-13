import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VocabularyItem {
  word: string;
  definition: string;
  difficulty: string;
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
    const { vocabulary, grammar, detectedLanguage, count = 10 } = await req.json();

    console.log('Generating practice sentences for:', detectedLanguage);
    console.log('Vocabulary count:', vocabulary?.length);
    console.log('Grammar count:', grammar?.length);

    if (!vocabulary || !grammar || vocabulary.length === 0 || grammar.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing vocabulary or grammar data',
          sentences: []
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const vocabularyWords = vocabulary.map((v: VocabularyItem) => v.word).join(', ');
    const grammarRules = grammar.map((g: GrammarItem) => g.rule).join('; ');

    const prompt = `Generate ${count} practice sentences in ${detectedLanguage} for language learners.

Vocabulary words to use: ${vocabularyWords}

Grammar patterns to demonstrate: ${grammarRules}

Requirements:
1. Each sentence should use 1-3 vocabulary words from the list
2. Each sentence should demonstrate at least 1 grammar pattern
3. Mix difficulty levels: some beginner, some intermediate, some advanced
4. Make sentences natural, conversational, and useful for real-world communication
5. Sentences should be practical and relevant to everyday situations

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
{
  "sentences": [
    {
      "text": "sentence in ${detectedLanguage}",
      "translation": "English translation",
      "difficulty": "beginner",
      "usedVocabulary": ["word1", "word2"],
      "usedGrammar": ["grammar rule name"]
    }
  ]
}`;

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
            content: 'You are a language learning expert. Generate practice sentences that help students apply vocabulary and grammar in context. Always respond with valid JSON only, no markdown formatting.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('OpenAI response received');

    let generatedText = data.choices[0].message.content.trim();
    console.log('Raw response (first 500 chars):', generatedText.substring(0, 500));
    
    // Remove markdown code blocks if present
    if (generatedText.startsWith('```json')) {
      generatedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (generatedText.startsWith('```')) {
      generatedText = generatedText.replace(/```\n?/g, '');
    }

    // Clean up control characters and fix common JSON issues
    generatedText = generatedText
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .trim();

    console.log('Cleaned response (first 500 chars):', generatedText.substring(0, 500));

    let result;
    try {
      result = JSON.parse(generatedText);
    } catch (parseError: any) {
      console.error('JSON parse error:', parseError.message);
      console.error('Failed to parse text:', generatedText);
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
