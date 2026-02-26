import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const messageSchema = z.object({
      role: z.enum(['user', 'ai']),
      text: z.string(),
    });

    const requestSchema = z.object({
      messages: z.array(messageSchema).min(1),
      projectContext: z.object({
        vocabulary: z.array(z.object({
          word: z.string(),
          definition: z.string().optional(),
          meaning: z.string().optional(),
        })).default([]),
        grammar: z.array(z.object({
          rule: z.string(),
          example: z.string(),
          explanation: z.string(),
        })).default([]),
        detectedLanguage: z.string(),
      }),
    });

    const { messages, projectContext } = requestSchema.parse(await req.json());

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No user messages to analyze', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const vocabWords = projectContext.vocabulary.map(v => v.word).join(', ');
    const grammarRules = projectContext.grammar.map(g => g.rule).join(', ');

    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'Student' : 'AI'}: ${m.text}`)
      .join('\n');

    const systemPrompt = `You are a language learning evaluator. Analyze the student's performance in a ${projectContext.detectedLanguage} conversation practice session.

Available vocabulary: ${vocabWords}
Available grammar patterns: ${grammarRules}

Analyze ONLY the student's messages for correctness, vocabulary usage, and grammar patterns. Use the generate_summary function to return structured feedback.`;

    const userPrompt = `Analyze this conversation:\n\n${conversationText}`;

    console.log('Generating conversation summary, messages:', messages.length);

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
          { role: 'user', content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_summary",
            description: "Generate a structured summary of the conversation practice session",
            parameters: {
              type: "object",
              properties: {
                overallScore: {
                  type: "number",
                  description: "Overall performance score from 1-10",
                },
                overallComment: {
                  type: "string",
                  description: "Brief overall assessment of the student's performance",
                },
                sentencesUsed: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      original: { type: "string", description: "What the student said" },
                      corrected: { type: "string", description: "Corrected version (same if correct)" },
                      translation: { type: "string", description: "English translation" },
                      isCorrect: { type: "boolean", description: "Whether the sentence was correct" },
                    },
                    required: ["original", "corrected", "translation", "isCorrect"],
                    additionalProperties: false,
                  },
                },
                vocabularyUsed: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      word: { type: "string" },
                      usedCorrectly: { type: "boolean" },
                      context: { type: "string", description: "How it was used" },
                      suggestion: { type: "string", description: "Improvement suggestion if applicable" },
                    },
                    required: ["word", "usedCorrectly", "context"],
                    additionalProperties: false,
                  },
                },
                grammarPatterns: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      pattern: { type: "string" },
                      usedCorrectly: { type: "boolean" },
                      example: { type: "string", description: "Example from the conversation" },
                      correction: { type: "string", description: "Correction if applicable" },
                    },
                    required: ["pattern", "usedCorrectly", "example"],
                    additionalProperties: false,
                  },
                },
                feedback: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string", description: "e.g. Pronunciation, Grammar, Vocabulary, Fluency" },
                      message: { type: "string" },
                      severity: { type: "string", enum: ["positive", "suggestion", "correction"] },
                    },
                    required: ["category", "message", "severity"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["overallScore", "overallComment", "sentencesUsed", "vocabularyUsed", "grammarPatterns", "feedback"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_summary" } },
      }),
    });

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: 'Rate limits exceeded, please try again later.', success: false }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (response.status === 402) {
      return new Response(
        JSON.stringify({ error: 'AI credits exhausted.', success: false }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall || toolCall.function.name !== 'generate_summary') {
      throw new Error('No valid tool call response from AI');
    }

    let summary;
    try {
      summary = JSON.parse(toolCall.function.arguments);
    } catch {
      console.error('Failed to parse summary response:', toolCall.function.arguments);
      throw new Error('Failed to parse AI summary response');
    }

    // Validate and sanitize
    if (!Array.isArray(summary.sentencesUsed)) summary.sentencesUsed = [];
    if (!Array.isArray(summary.vocabularyUsed)) summary.vocabularyUsed = [];
    if (!Array.isArray(summary.grammarPatterns)) summary.grammarPatterns = [];
    if (!Array.isArray(summary.feedback)) summary.feedback = [];
    if (typeof summary.overallScore !== 'number') summary.overallScore = 5;
    if (typeof summary.overallComment !== 'string') summary.overallComment = '';

    // Clamp score
    summary.overallScore = Math.max(1, Math.min(10, Math.round(summary.overallScore)));

    console.log('Summary generated, score:', summary.overallScore);

    return new Response(
      JSON.stringify({ success: true, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in conversation-summary:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
