
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced transcript extraction with multiple fallback methods
async function extractTranscript(videoId: string) {
  try {
    // Method 1: Try direct timedtext API with different formats
    const formats = ['json3', 'srv3', 'srv2', 'srv1'];
    const languages = ['en', 'ja', 'es', 'fr', 'de', 'it', 'auto'];
    
    for (const format of formats) {
      for (const lang of languages) {
        const transcriptUrl = `https://www.youtube.com/api/timedtext?lang=${lang}&v=${videoId}&fmt=${format}`;
        
        console.log(`Trying format: ${format}, language: ${lang}`);
        
        try {
          const response = await fetch(transcriptUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          if (response.ok) {
            const responseText = await response.text();
            console.log(`Response length for ${format}/${lang}:`, responseText.length);
            
            if (responseText && responseText.trim().length > 10) {
              // Try to parse based on format
              if (format === 'json3') {
                try {
                  const data = JSON.parse(responseText);
                  if (data.events && data.events.length > 0) {
                    return extractTextFromTimedText(data);
                  }
                } catch (parseError) {
                  console.log('JSON parse failed, trying XML parsing');
                }
              }
              
              // Fallback: extract text from XML formats
              const xmlText = extractTextFromXML(responseText);
              if (xmlText && xmlText.length > 50) {
                return xmlText;
              }
            }
          }
        } catch (error) {
          console.log(`Error with ${format}/${lang}:`, error.message);
          continue;
        }
      }
    }
    
    // Method 2: Try getting caption tracks list first
    try {
      const captionListUrl = `https://www.youtube.com/api/timedtext?type=list&v=${videoId}`;
      const listResponse = await fetch(captionListUrl);
      
      if (listResponse.ok) {
        const listText = await listResponse.text();
        console.log('Caption tracks available:', listText.substring(0, 200));
        
        // Parse available tracks and try the first available one
        const trackMatch = listText.match(/lang_code="([^"]+)"/);
        if (trackMatch) {
          const availableLang = trackMatch[1];
          console.log('Found available language:', availableLang);
          
          const trackUrl = `https://www.youtube.com/api/timedtext?lang=${availableLang}&v=${videoId}&fmt=srv3`;
          const trackResponse = await fetch(trackUrl);
          
          if (trackResponse.ok) {
            const trackText = await trackResponse.text();
            if (trackText && trackText.length > 10) {
              return extractTextFromXML(trackText);
            }
          }
        }
      }
    } catch (error) {
      console.log('Caption list method failed:', error.message);
    }
    
    throw new Error('No accessible transcript found for this video');
    
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

function extractTextFromXML(xmlText: string): string {
  try {
    // Extract text from XML caption formats
    const textMatches = xmlText.match(/<text[^>]*>([^<]+)<\/text>/g);
    if (textMatches) {
      let transcript = '';
      for (const match of textMatches) {
        const textContent = match.replace(/<[^>]*>/g, '').trim();
        if (textContent) {
          // Decode HTML entities
          const decoded = textContent
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
          transcript += decoded + ' ';
        }
      }
      return transcript.trim();
    }
    
    // Alternative: try to extract any text content between tags
    const simpleTextMatches = xmlText.match(/>([^<]+)</g);
    if (simpleTextMatches) {
      let transcript = '';
      for (const match of simpleTextMatches) {
        const text = match.slice(1, -1).trim();
        if (text && text.length > 2 && !text.includes('=')) {
          transcript += text + ' ';
        }
      }
      return transcript.trim();
    }
    
    return '';
  } catch (error) {
    console.error('XML parsing error:', error);
    return '';
  }
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

    // Extract transcript using enhanced method
    const transcript = await extractTranscript(videoId);
    
    if (!transcript || transcript.length < 10) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No transcript available or transcript too short',
          suggestion: 'This video may not have captions available, may be age-restricted, or captions may be disabled by the creator.'
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
