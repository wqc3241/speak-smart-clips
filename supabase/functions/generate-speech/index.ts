import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const validVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer'] as const;

const requestSchema = z.object({
    text: z.string().min(1, 'Text is required').max(4096, 'Text must be less than 4096 characters'),
    voice: z.enum(validVoices).default('coral'),
    instructions: z.string().max(500, 'Instructions must be less than 500 characters').optional(),
});

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const validation = requestSchema.safeParse(body);

        if (!validation.success) {
            return new Response(
                JSON.stringify({ error: validation.error.issues[0].message }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            );
        }

        const { text, voice, instructions } = validation.data;

        const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openAiApiKey) {
            throw new Error('OPENAI_API_KEY is not configured');
        }

        console.log(`Generating speech for text: "${text.substring(0, 50)}..." with voice: ${voice}${instructions ? ` and instructions: "${instructions.substring(0, 50)}..."` : ''}`);

        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openAiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini-tts',
                input: text,
                voice: voice,
                ...(instructions && { instructions }),
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('OpenAI API error:', error);
            throw new Error(`OpenAI API error: ${error}`);
        }

        // Return the audio stream directly
        return new Response(response.body, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'audio/mpeg',
            },
        });

    } catch (error) {
        console.error('Error in generate-speech function:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});
