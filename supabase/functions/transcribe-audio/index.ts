import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const formData = await req.formData();
    const audioFile = formData.get('file') as File | null;
    const language = (formData.get('language') as string) || undefined;

    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: 'No audio file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`Transcribing audio: ${audioFile.size} bytes, type=${audioFile.type}, lang=${language ?? 'auto'}`);

    const whisperForm = new FormData();
    whisperForm.append('file', audioFile, audioFile.name || 'audio.webm');
    whisperForm.append('model', 'whisper-1');
    if (language) {
      // Whisper expects ISO 639-1 codes (e.g. "en", "ja", "zh")
      whisperForm.append('language', language.split('-')[0]);
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openAiApiKey}` },
      body: whisperForm,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Whisper API error:', errText);
      throw new Error(`Whisper API error: ${errText}`);
    }

    const result = await response.json();
    console.log(`Transcription result: "${result.text?.substring(0, 80)}..."`);

    return new Response(
      JSON.stringify({ success: true, text: result.text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in transcribe-audio:', error);
    const msg = (error as Error).message;
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
