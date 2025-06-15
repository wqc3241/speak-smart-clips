
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple transcript extraction function
async function extractTranscript(videoId: string) {
  try {
    // Try to get transcript from YouTube's timedtext API
    const transcriptUrl = `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}&fmt=json3`;
    
    console.log('Attempting to fetch transcript from:', transcriptUrl);
    
    const response = await fetch(transcriptUrl);
    
    if (!response.ok) {
      console.log('English transcript failed, trying alternative languages');
      
      // Try alternative languages if English fails
      const altLanguages = ['ja', 'es', 'fr', 'de', 'it', 'auto'];
      
      for (const lang of altLanguages) {
        const altUrl = `https://www.youtube.com/api/timedtext?lang=${lang}&v=${videoId}&fmt=json3`;
        console.log('Trying alternative language:', lang);
        
        const altResponse = await fetch(altUrl);
        if (altResponse.ok) {
          const responseText = await altResponse.text();
          console.log('Response text length:', responseText.length);
          
          if (responseText && responseText.trim().length > 0) {
            try {
              const data = JSON.parse(responseText);
              if (data.events && data.events.length > 0) {
                return extractTextFromTimedText(data);
              }
            } catch (parseError) {
              console.log('JSON parse error for language', lang, ':', parseError);
              continue;
            }
          }
        }
      }
      
      throw new Error('No transcript available in supported languages');
    }
    
    const responseText = await response.text();
    console.log('Response text length:', responseText.length);
    
    if (!responseText || responseText.trim().length === 0) {
      throw new Error('Empty response from YouTube API');
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.log('Raw response:', responseText.substring(0, 500));
      throw new Error('Invalid JSON response from YouTube API');
    }
    
    if (!data.events || data.events.length === 0) {
      throw new Error('No transcript content found');
    }
    
    return extractTextFromTimedText(data);
    
  } catch (error) {
    console.error('Transcript extraction error:', error);
    throw error;
  }
}

function extractTextFromTimedText(data: any): string {
  if (!data.events) return '';
  
  let transcript = '';
  
  for (const event of data.events) {
    if (event.segs) {
      for (const seg of event.segs) {
        if (seg.utf8) {
          // Clean up the text and add proper spacing
          const text = seg.utf8.replace(/\n/g, ' ').trim();
          if (text) {
            transcript += text + ' ';
          }
        }
      }
    }
  }
  
  return transcript.trim();
}

async function getVideoTitle(videoId: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data.items && data.items.length > 0) {
        return data.items[0].snippet.title;
      }
    }
  } catch (error) {
    console.error('Error fetching video title:', error);
  }
  
  return `Video ${videoId}`;
}

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

    // Get video title
    const videoTitle = await getVideoTitle(videoId, youtubeApiKey);
    console.log('Processing video:', videoTitle);

    // Extract transcript using timedtext API
    const transcript = await extractTranscript(videoId);
    
    if (!transcript || transcript.length < 10) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No transcript available or transcript too short',
          suggestion: 'This video may not have captions available or may be age-restricted.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Successfully extracted transcript, length:', transcript.length);

    return new Response(
      JSON.stringify({
        success: true,
        videoTitle,
        transcript,
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
