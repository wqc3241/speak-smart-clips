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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const apiKey = Deno.env.get('YOUTUBE_API_KEY');
    if (!apiKey) {
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

    const searchParams = new URLSearchParams({
      part: 'snippet',
      q: params.query,
      type: 'video',
      videoCaption: 'closedCaption',
      maxResults: String(params.maxResults),
      key: apiKey,
    });

    if (params.languageCode) {
      searchParams.set('relevanceLanguage', params.languageCode);
    }

    const url = `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`;
    console.log('=== YouTube Search: querying:', params.query);

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('=== YouTube Search: API error:', response.status, errorText);

      if (response.status === 403) {
        return new Response(
          JSON.stringify({ success: false, error: 'YouTube API quota exceeded or key restricted. Try again later.' }),
          { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: `YouTube API error: ${response.status}` }),
        { status: response.status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
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

    console.log(`=== YouTube Search: found ${results.length} results`);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
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
