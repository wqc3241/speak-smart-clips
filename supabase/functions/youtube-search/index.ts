import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function getApiKeys(): string[] {
  const keys: string[] = [];

  // Load keys from YOUTUBE_API_KEY, YOUTUBE_API_KEY_2, YOUTUBE_API_KEY_3, etc.
  const primary = Deno.env.get('YOUTUBE_API_KEY');
  if (primary) keys.push(primary);

  for (let i = 2; i <= 10; i++) {
    const key = Deno.env.get(`YOUTUBE_API_KEY_${i}`);
    if (key) keys.push(key);
  }

  return keys;
}

async function searchWithKey(
  apiKey: string,
  query: string,
  maxResults: number,
  languageCode?: string
): Promise<{ ok: true; results: unknown[] } | { ok: false; quotaExceeded: boolean; status: number; error: string }> {
  const searchParams = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    videoCaption: 'closedCaption',
    maxResults: String(maxResults),
    key: apiKey,
  });

  if (languageCode) {
    searchParams.set('relevanceLanguage', languageCode);
  }

  const url = `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    const quotaExceeded = response.status === 403;
    if (quotaExceeded) {
      console.warn(`=== YouTube Search: quota exceeded for key ...${apiKey.slice(-6)}`);
    } else {
      console.error(`=== YouTube Search: API error ${response.status} for key ...${apiKey.slice(-6)}:`, errorText);
    }
    return { ok: false, quotaExceeded, status: response.status, error: errorText };
  }

  const data = await response.json();

  const results = (data.items || []).map((item: {
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      thumbnails?: { medium?: { url?: string } };
      channelTitle?: string;
      publishedAt?: string;
      description?: string;
    };
  }) => ({
    videoId: item.id?.videoId || '',
    title: decodeHtmlEntities(item.snippet?.title || ''),
    thumbnail: item.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${item.id?.videoId}/mqdefault.jpg`,
    channelTitle: decodeHtmlEntities(item.snippet?.channelTitle || ''),
    publishedAt: item.snippet?.publishedAt || '',
    description: decodeHtmlEntities(item.snippet?.description || ''),
  }));

  return { ok: true, results };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const apiKeys = getApiKeys();
    if (apiKeys.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'YouTube API key not configured' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const requestSchema = z.object({
      query: z.string().min(1).max(200),
      maxResults: z.number().int().min(1).max(25).optional().default(12),
      languageCode: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).optional(),
    });

    const params = requestSchema.parse(await req.json());

    console.log(`=== YouTube Search: querying "${params.query}" with ${apiKeys.length} API key(s)`);

    // Try each key in order; rotate on quota exceeded (403)
    let lastError = '';
    let lastStatus = 500;

    for (let i = 0; i < apiKeys.length; i++) {
      const result = await searchWithKey(apiKeys[i], params.query, params.maxResults, params.languageCode);

      if (result.ok) {
        console.log(`=== YouTube Search: found ${result.results.length} results (key ${i + 1}/${apiKeys.length})`);
        return new Response(
          JSON.stringify({ success: true, results: result.results }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      lastError = result.error;
      lastStatus = result.status;

      // Only retry with next key if quota exceeded; other errors are not key-specific
      if (!result.quotaExceeded) break;
    }

    // All keys exhausted or non-quota error
    if (lastStatus === 403) {
      return new Response(
        JSON.stringify({ success: false, error: 'YouTube API quota exceeded on all keys. Try again later.' }),
        { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `YouTube API error: ${lastStatus}` }),
      { status: lastStatus, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in youtube-search function:', error);
    const message = error instanceof Error ? error.message : 'Search failed';

    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
