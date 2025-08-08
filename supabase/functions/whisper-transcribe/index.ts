import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractVideoId(input: string): string | null {
  try {
    // If it's already a bare ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
    // Try to parse from URL
    const match = input.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function fetchVideoTitle(videoId: string): Promise<string> {
  try {
    const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
    if (res.ok) {
      const meta = await res.json();
      if (meta?.title) return meta.title as string;
    }
  } catch (_) {}
  return `YouTube Video - ${videoId}`;
}

async function getYouTubeAudioUrl(videoId: string): Promise<{ url: string; mime: string } | null> {
  // Strategy A: Parse watch page for adaptive audio formats
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(watchUrl, {
      headers: {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
        "cache-control": "no-cache",
        "pragma": "no-cache",
      },
    });
    const html = await res.text();

    const playerRespMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;?/s);
    if (playerRespMatch) {
      const json = JSON.parse(playerRespMatch[1]);
      const streaming = json?.streamingData;
      const adaptive = streaming?.adaptiveFormats || [];

      const candidates = adaptive.filter((f: any) => String(f.mimeType || '').includes('audio'));
      const prefer = [
        (f: any) => String(f.mimeType || '').includes('audio/mp4'),
        (f: any) => String(f.mimeType || '').includes('audio/webm'),
      ];

      for (const pref of prefer) {
        const pick = candidates.find(pref) || candidates[0];
        if (!pick) break;
        // Direct URL available
        if (pick.url) {
          const mime = String(pick.mimeType || '').split(';')[0] || 'audio/mp4';
          return { url: pick.url as string, mime };
        }
        // Some formats require signature deciphering (signatureCipher). Not supported here.
        // We skip those and try other strategies.
      }
    }
  } catch (e) {
    console.warn('Watch page parse failed:', e);
  }

  // Strategy B: Piped API fallback (public instance)
  try {
    const piped = await fetch(`https://piped.video/api/v1/streams/${videoId}`, {
      headers: { 'accept': 'application/json' },
    });
    if (piped.ok) {
      const data = await piped.json();
      const audioStreams = data?.audioStreams || [];
      // Prefer m4a/mp4 then webm
      const preferred = audioStreams.find((s: any) => /m4a|mp4/.test(s?.mimeType || s?.type || '')) || audioStreams[0];
      if (preferred?.url) {
        const mime = preferred?.mimeType || preferred?.type || 'audio/mp4';
        return { url: preferred.url as string, mime };
      }
    }
  } catch (e) {
    console.warn('Piped fallback failed:', e);
  }

  return null;
}

async function downloadAudio(url: string, maxBytes = 25 * 1024 * 1024): Promise<Uint8Array> {
  // HEAD to verify size when possible
  try {
    const head = await fetch(url, { method: 'HEAD' });
    const len = head.headers.get('content-length');
    if (len && Number(len) > maxBytes) {
      throw new Error(`Audio too large: ${len} bytes`);
    }
  } catch (_) {
    // Some CDNs block HEAD; proceed to GET
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download audio: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > maxBytes) throw new Error(`Audio too large after download: ${buf.byteLength} bytes`);
  return buf;
}

function uint8ToBlob(u8: Uint8Array, type: string): Blob {
  return new Blob([u8], { type });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl, videoId: rawId } = await req.json();
    const videoId = extractVideoId(videoUrl || rawId);
    if (!videoId) {
      return new Response(JSON.stringify({ success: false, error: 'Missing or invalid video URL/ID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const audio = await getYouTubeAudioUrl(videoId);
    if (!audio) {
      return new Response(JSON.stringify({ success: false, error: 'Could not resolve audio stream for this video.' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bytes = await downloadAudio(audio.url);
    const blob = uint8ToBlob(bytes, audio.mime || 'audio/mp4');

    const form = new FormData();
    form.append('file', blob, `audio.${audio.mime?.includes('webm') ? 'webm' : 'mp4'}`);
    form.append('model', 'whisper-1');

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) throw new Error('OPENAI_API_KEY is not set');

    const stt = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openAIApiKey}` },
      body: form,
    });

    if (!stt.ok) {
      const errText = await stt.text();
      throw new Error(`OpenAI error: ${stt.status} ${errText}`);
    }

    const result = await stt.json();
    const text: string = result.text || '';
    const title = await fetchVideoTitle(videoId);

    return new Response(JSON.stringify({ success: true, transcript: text, videoTitle: title }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('whisper-transcribe error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error?.message || error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
