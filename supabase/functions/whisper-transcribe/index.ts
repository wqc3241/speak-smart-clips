import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const VERBOSE = Deno.env.get("VERBOSE_AUDIO_RESOLVER") === "true";

function extractVideoId(input: string): string | null {
  try {
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
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
  const fetchJsonSafe = async (url: string, timeoutMs = 4000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { headers: { accept: "application/json" }, signal: controller.signal });
      const ct = resp.headers.get("content-type") || "";
      if (!resp.ok) return null;
      if (!ct.includes("application/json")) return null;
      return await resp.json();
    } catch (_e) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
  const TIMEOUT_MS = 4000;
  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Strategy A: Try multiple Piped instances (JSON)
  const pipedHosts = [...shuffle([
    "https://pipedapi.kavin.rocks",
    "https://piped.projectsegfau.lt",
    "https://piped.privacydev.net",
    "https://pi.ggtyler.dev",
  ]), "https://piped.video"];
  for (const host of pipedHosts) {
    try {
      const data = await fetchJsonSafe(`${host}/api/v1/streams/${videoId}`);
      const audioStreams = data?.audioStreams || [];
      const preferred =
        audioStreams.find((s: any) => /m4a|mp4/i.test(s?.mimeType || s?.type || "")) ||
        audioStreams.find((s: any) => /webm/i.test(s?.mimeType || s?.type || "")) ||
        audioStreams[0];
      if (preferred?.url) {
        const mime = preferred?.mimeType || preferred?.type || "audio/mp4";
        return { url: preferred.url as string, mime };
      }
    } catch (e) {
      if (VERBOSE) console.debug(`Piped host failed ${host}:`, e);
      continue;
    }
  }

  // Strategy B: Invidious JSON
  const invidiousHosts = [
    ...shuffle([
      "https://invidious.flokinet.to",
      "https://vid.puffyan.us",
      "https://invidious.nerdvpn.de",
      "https://invidious.jing.rocks",
    ]),
    // Place rate-limited host last
    "https://yewtu.be",
  ];
  for (const host of invidiousHosts) {
    try {
      const data = await fetchJsonSafe(`${host}/api/v1/videos/${videoId}`);
      const adaptive = data?.adaptiveFormats || data?.formatStreams || [];
      const candidates = adaptive.filter((f: any) =>
        String(f?.type || f?.mimeType || "").toLowerCase().includes("audio")
      );
      const preferred =
        candidates.find((f: any) => /audio\/mp4|m4a/i.test(f?.type || f?.mimeType || "")) ||
        candidates.find((f: any) => /audio\/webm/i.test(f?.type || f?.mimeType || "")) ||
        candidates[0];
      const url = preferred?.url || preferred?.url_signature || preferred?.link;
      if (url) {
        const mime = (preferred?.type || preferred?.mimeType || "audio/mp4").split(";")[0];
        return { url, mime };
      }
    } catch (e) {
      if (VERBOSE) console.debug(`Invidious host failed ${host}:`, e);
      continue;
    }
  }

  // Strategy C: Invidious latest_version endpoint (direct stream by itag)
  const latestVersionItags = [140, 251]; // 140=m4a, 251=webm opus
  for (const host of invidiousHosts) {
    for (const itag of latestVersionItags) {
      const url = `${host}/latest_version?id=${videoId}&itag=${itag}`;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          const head = await fetch(url, { method: "HEAD", signal: controller.signal });
          if (head.ok) {
            const mime = (head.headers.get("content-type") || "").split(";")[0] || (itag === 140 ? "audio/mp4" : "audio/webm");
            return { url, mime };
          }
        } finally {
          clearTimeout(timer);
        }
      } catch (e) {
        if (VERBOSE) console.debug(`latest_version failed ${host} itag=${itag}:`, e);
      }
    }
  }

  // Strategy D: Watch page parse (best-effort; might lack direct url)
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let html = "";
    try {
      const res = await fetch(watchUrl, {
        headers: {
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
          "cache-control": "no-cache",
          pragma: "no-cache",
        },
        signal: controller.signal,
      });
      html = await res.text();
    } finally {
      clearTimeout(timer);
    }

    // Robustly extract JSON by balancing braces from marker position
    const marker = "ytInitialPlayerResponse";
    const idx = html.indexOf(marker);
    if (idx !== -1) {
      const start = html.indexOf("{", idx);
      if (start !== -1) {
        let depth = 0;
        let end = start;
        for (; end < html.length; end++) {
          const ch = html[end];
          if (ch === "{") depth++;
          else if (ch === "}") {
            depth--;
            if (depth === 0) {
              end++;
              break;
            }
          }
        }
        const jsonStr = html.slice(start, end);
        const json = JSON.parse(jsonStr);
        const adaptive = json?.streamingData?.adaptiveFormats || [];
        const direct = adaptive.find((f: any) => String(f.mimeType || "").includes("audio") && !!f.url);
        if (direct?.url) {
          const mime = String(direct.mimeType || "").split(";")[0] || "audio/mp4";
          return { url: direct.url as string, mime };
        }
      }
    }
  } catch (e) {
    if (VERBOSE) console.debug("Watch page parse fallback failed:", e);
  }

  if (!VERBOSE) {
    console.log(`Audio resolution failed after all strategies for video ${videoId}`);
  } else {
    console.debug(`Audio resolution failed after all strategies for video ${videoId}`);
  }
  return null;
}

async function downloadAudio(url: string, maxBytes = 32 * 1024 * 1024): Promise<Uint8Array> {
  try {
    const head = await fetch(url, { method: "HEAD" });
    const len = head.headers.get("content-length");
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl, videoId: rawId } = await req.json();
    const videoId = extractVideoId(videoUrl || rawId);
    if (!videoId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing or invalid video URL/ID" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const audio = await getYouTubeAudioUrl(videoId);
    if (!audio) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not resolve audio stream for this video." }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const bytes = await downloadAudio(audio.url);
    const blob = uint8ToBlob(bytes, audio.mime || "audio/mp4");

    const form = new FormData();
    form.append("file", blob, `audio.${audio.mime?.includes("webm") ? "webm" : "mp4"}`);
    form.append("model", "whisper-1");

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) throw new Error("OPENAI_API_KEY is not set");

    const stt = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAIApiKey}` },
      body: form,
    });

    if (!stt.ok) {
      const errText = await stt.text();
      throw new Error(`OpenAI error: ${stt.status} ${errText}`);
    }

    const result = await stt.json();
    const text: string = result.text || "";
    const title = await fetchVideoTitle(videoId);

    return new Response(
      JSON.stringify({ success: true, transcript: text, videoTitle: title }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("whisper-transcribe error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error?.message || error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
