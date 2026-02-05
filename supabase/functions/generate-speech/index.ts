import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const validVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer'] as const;

// Max characters per chunk (conservative limit to stay under 2000 tokens)
// Japanese uses ~1.5-2 tokens per character, so 2500 chars is safe
const MAX_CHUNK_CHARS = 2500;

const requestSchema = z.object({
    text: z.string().min(1, 'Text is required'),
    voice: z.enum(validVoices).default('coral'),
    instructions: z.string().max(500, 'Instructions must be less than 500 characters').optional(),
});

// Split text into chunks at sentence boundaries
function chunkText(text: string, maxChars: number): string[] {
    if (text.length <= maxChars) {
        return [text];
    }
    
    const chunks: string[] = [];
    let remaining = text;
    
    while (remaining.length > 0) {
        if (remaining.length <= maxChars) {
            chunks.push(remaining);
            break;
        }
        
        // Try to split at sentence boundaries (。, !, ?, ., newlines)
        let splitIndex = -1;
        const searchRange = remaining.substring(0, maxChars);
        
        // Look for Japanese sentence endings first
        const jpEndings = ['。', '！', '？', '\n'];
        for (const ending of jpEndings) {
            const idx = searchRange.lastIndexOf(ending);
            if (idx > splitIndex) {
                splitIndex = idx + 1;
            }
        }
        
        // Fall back to English punctuation
        if (splitIndex <= 0) {
            const enEndings = ['. ', '! ', '? '];
            for (const ending of enEndings) {
                const idx = searchRange.lastIndexOf(ending);
                if (idx > splitIndex) {
                    splitIndex = idx + ending.length;
                }
            }
        }
        
        // Last resort: split at space or just cut
        if (splitIndex <= 0) {
            const spaceIdx = searchRange.lastIndexOf(' ');
            splitIndex = spaceIdx > 0 ? spaceIdx + 1 : maxChars;
        }
        
        chunks.push(remaining.substring(0, splitIndex).trim());
        remaining = remaining.substring(splitIndex).trim();
    }
    
    return chunks.filter(c => c.length > 0);
}

// Concatenate multiple audio buffers
function concatAudioBuffers(buffers: Uint8Array[]): Uint8Array {
    const totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
        result.set(buf, offset);
        offset += buf.length;
    }
    return result;
}

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

        // Split text into chunks if too long
        const chunks = chunkText(text, MAX_CHUNK_CHARS);
        console.log(`Generating speech for ${chunks.length} chunk(s), total length: ${text.length} chars, voice: ${voice}`);

        const audioBuffers: Uint8Array[] = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            console.log(`Processing chunk ${i + 1}/${chunks.length}: ${chunk.length} chars`);
            
            const response = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${openAiApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini-tts',
                    input: chunk,
                    voice: voice,
                    ...(instructions && { instructions }),
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                console.error(`OpenAI API error for chunk ${i + 1}:`, error);
                throw new Error(`OpenAI API error: ${error}`);
            }

            const buffer = new Uint8Array(await response.arrayBuffer());
            audioBuffers.push(buffer);
        }

        // Concatenate all audio chunks
        const combinedAudio = concatAudioBuffers(audioBuffers);
        console.log(`Generated ${combinedAudio.length} bytes of audio`);

        return new Response(combinedAudio, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'audio/mpeg',
            },
        });

    } catch (error) {
        console.error('Error in generate-speech function:', error);
    const errorObj = error as Error;
    return new Response(
      JSON.stringify({ error: errorObj.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});
