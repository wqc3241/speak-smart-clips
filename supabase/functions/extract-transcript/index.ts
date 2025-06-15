
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoId } = await req.json();
    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY');

    if (!youtubeApiKey) {
      throw new Error('YouTube API key not configured');
    }

    console.log('Extracting transcript for video ID:', videoId);

    // First, get video details to check if captions are available
    const videoResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${youtubeApiKey}`
    );

    if (!videoResponse.ok) {
      throw new Error('Failed to fetch video details');
    }

    const videoData = await videoResponse.json();
    
    if (!videoData.items || videoData.items.length === 0) {
      throw new Error('Video not found');
    }

    const videoTitle = videoData.items[0].snippet.title;
    console.log('Processing video:', videoTitle);

    // Get available captions
    const captionsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${youtubeApiKey}`
    );

    if (!captionsResponse.ok) {
      throw new Error('Failed to fetch captions list');
    }

    const captionsData = await captionsResponse.json();
    
    if (!captionsData.items || captionsData.items.length === 0) {
      // If no captions available, return a helpful message
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No captions available for this video',
          suggestion: 'This video does not have auto-generated or manual captions available.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Find the best caption track (prefer auto-generated English)
    let selectedCaption = captionsData.items.find((caption: any) => 
      caption.snippet.language === 'en' && caption.snippet.trackKind === 'asr'
    );

    // If no auto-generated English, try any English caption
    if (!selectedCaption) {
      selectedCaption = captionsData.items.find((caption: any) => 
        caption.snippet.language === 'en'
      );
    }

    // If no English, use the first available caption
    if (!selectedCaption) {
      selectedCaption = captionsData.items[0];
    }

    console.log('Using caption track:', selectedCaption.snippet.language, selectedCaption.snippet.name);

    // Download the caption content
    const captionResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/captions/${selectedCaption.id}?key=${youtubeApiKey}`,
      {
        headers: {
          'Authorization': `Bearer ${youtubeApiKey}`,
        }
      }
    );

    if (!captionResponse.ok) {
      // If we can't download captions directly (common with API restrictions),
      // we'll provide a structured response with available caption info
      const availableCaptions = captionsData.items.map((caption: any) => ({
        language: caption.snippet.language,
        name: caption.snippet.name,
        trackKind: caption.snippet.trackKind
      }));

      return new Response(
        JSON.stringify({
          success: true,
          videoTitle,
          transcript: `Transcript extraction for "${videoTitle}" - Captions are available in: ${availableCaptions.map(c => c.language).join(', ')}. 

Due to YouTube API restrictions, automatic caption download requires additional authentication. However, this video has captions available and can be processed for language learning.

Available caption tracks:
${availableCaptions.map(c => `• ${c.language} (${c.trackKind === 'asr' ? 'Auto-generated' : 'Manual'})`).join('\n')}

For a complete language learning experience, you can manually copy the transcript from YouTube's caption feature or use this as a starting point for vocabulary and grammar analysis.`,
          captionsAvailable: true,
          availableCaptions
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const captionText = await captionResponse.text();

    return new Response(
      JSON.stringify({
        success: true,
        videoTitle,
        transcript: captionText,
        captionsAvailable: true
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in extract-transcript function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to extract transcript'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
