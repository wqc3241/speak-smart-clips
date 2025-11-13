import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CaptionTrack {
  languageCode: string;
  name: string;
  kind: string;
}

function extractCaptionTracksFromPage(htmlContent: string): CaptionTrack[] {
  try {
    // Look for captionTracks in the ytInitialPlayerResponse
    const regex = /"captionTracks":\s*(\[.*?\])/;
    const match = htmlContent.match(regex);
    
    if (!match) {
      console.log('No caption tracks found in page');
      return [];
    }
    
    const captionTracksJson = match[1];
    const captionTracks = JSON.parse(captionTracksJson);
    
    console.log('Found caption tracks:', captionTracks.length);
    return captionTracks.map((track: any) => ({
      languageCode: track.languageCode,
      name: track.name?.simpleText || track.languageCode,
      kind: track.kind || 'standard'
    }));
  } catch (error) {
    console.error('Error parsing caption tracks:', error);
    return [];
  }
}

function getLanguageName(code: string): string {
  const languageNames: { [key: string]: string } = {
    'en': 'English',
    'ja': 'Japanese (日本語)',
    'es': 'Spanish (Español)',
    'fr': 'French (Français)',
    'de': 'German (Deutsch)',
    'zh': 'Chinese (中文)',
    'ar': 'Arabic (العربية)',
    'ko': 'Korean (한국어)',
    'pt': 'Portuguese (Português)',
    'it': 'Italian (Italiano)',
    'ru': 'Russian (Русский)',
    'hi': 'Hindi (हिन्दी)',
    'nl': 'Dutch (Nederlands)',
    'sv': 'Swedish (Svenska)',
    'pl': 'Polish (Polski)',
    'tr': 'Turkish (Türkçe)',
    'vi': 'Vietnamese (Tiếng Việt)',
    'th': 'Thai (ไทย)',
    'id': 'Indonesian (Bahasa Indonesia)',
  };
  return languageNames[code] || code.toUpperCase();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate input
    const requestSchema = z.object({
      videoId: z.string().regex(/^[a-zA-Z0-9_-]{11}$/, 'Invalid YouTube video ID format')
    });
    
    const { videoId } = requestSchema.parse(await req.json());

    console.log('=== Fetching available languages for video:', videoId);
    
    // Approach: Scrape YouTube page for available caption tracks
    const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const pageResponse = await fetch(videoPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    
    if (!pageResponse.ok) {
      throw new Error(`Failed to fetch video page: ${pageResponse.status}`);
    }
    
    const pageContent = await pageResponse.text();
    const captionTracks = extractCaptionTracksFromPage(pageContent);
    
    if (captionTracks.length > 0) {
      // Sort: manual captions first, then auto-generated
      const sortedTracks = captionTracks.sort((a, b) => {
        if (a.kind === 'asr' && b.kind !== 'asr') return 1;
        if (a.kind !== 'asr' && b.kind === 'asr') return -1;
        return 0;
      });
      
      const languages = sortedTracks.map(track => ({
        code: track.languageCode,
        name: track.name || getLanguageName(track.languageCode),
        type: track.kind === 'asr' ? 'auto-generated' : 'manual'
      }));
      
      console.log('=== Available languages:', languages.length);
      
      return new Response(JSON.stringify({
        success: true,
        availableLanguages: languages
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // No captions found
    console.log('=== No caption tracks found');
    return new Response(JSON.stringify({
      success: true,
      availableLanguages: []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error in get-available-languages:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to fetch available languages'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
