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
      text: z.string().max(5000),
    });

    const projectContextSchema = z.object({
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
      title: z.string(),
    });

    const requestSchema = z.object({
      messages: z.array(messageSchema).max(100),
      projectContext: projectContextSchema,
    });

    const { messages, projectContext } = requestSchema.parse(await req.json());

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const vocabList = projectContext.vocabulary
      .map(v => `${v.word} (${v.definition || v.meaning || ''})`)
      .join(', ');
    const grammarList = projectContext.grammar
      .map(g => g.rule)
      .join(', ');

    const systemPrompt = `You are a friendly language conversation partner helping a student practice ${projectContext.detectedLanguage}. The student is learning from a lesson titled "${projectContext.title}".

KEY RULES:
1. Respond primarily in ${projectContext.detectedLanguage}. Keep responses short (1-3 sentences) since this is a voice conversation.
2. Naturally incorporate these vocabulary words when appropriate: ${vocabList}
3. Use these grammar patterns when possible: ${grammarList}
4. If the student makes a mistake, gently correct it by rephrasing their sentence correctly, then continue the conversation.
5. Ask follow-up questions to keep the conversation going.
6. Be encouraging and supportive.
7. If this is the start of a conversation (no prior messages), introduce yourself briefly and ask the student a simple opening question using the lesson vocabulary.`;

    // Convert messages to OpenAI format
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.text,
      })),
    ];

    // If no user messages yet, add a trigger for the opening message
    if (messages.length === 0) {
      chatMessages.push({
        role: 'user',
        content: `Start the conversation. Greet me and ask an opening question in ${projectContext.detectedLanguage}.`,
      });
    }

    console.log('Conversation chat request, messages:', messages.length);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: chatMessages,
        max_tokens: 300,
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
    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      throw new Error('No reply from AI');
    }

    console.log('Conversation reply generated, length:', reply.length);

    return new Response(
      JSON.stringify({ success: true, reply }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in conversation-chat:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
