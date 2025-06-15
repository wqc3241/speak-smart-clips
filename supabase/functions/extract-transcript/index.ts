
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced transcript extraction with audio analysis fallback
async function extractTranscript(videoId: string) {
  try {
    // Method 1: Try existing caption methods first
    const existingTranscript = await tryExistingCaptions(videoId);
    if (existingTranscript) {
      console.log('Found existing captions');
      return existingTranscript;
    }

    // Method 2: Use Whisper API for audio transcription
    console.log('No existing captions found, attempting audio transcription...');
    return await transcribeAudioWithWhisper(videoId);
    
  } catch (error) {
    console.error('Transcript extraction error:', error);
    throw error;
  }
}

async function tryExistingCaptions(videoId: string) {
  const formats = ['json3', 'srv3', 'srv2', 'srv1'];
  const languages = ['en', 'ja', 'es', 'fr', 'de', 'it', 'auto'];
  
  for (const format of formats) {
    for (const lang of languages) {
      const transcriptUrl = `https://www.youtube.com/api/timedtext?lang=${lang}&v=${videoId}&fmt=${format}`;
      
      try {
        const response = await fetch(transcriptUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (response.ok) {
          const responseText = await response.text();
          
          if (responseText && responseText.trim().length > 10) {
            if (format === 'json3') {
              try {
                const data = JSON.parse(responseText);
                if (data.events && data.events.length > 0) {
                  return extractTextFromTimedText(data);
                }
              } catch (parseError) {
                // Continue to XML parsing
              }
            }
            
            const xmlText = extractTextFromXML(responseText);
            if (xmlText && xmlText.length > 50) {
              return xmlText;
            }
          }
        }
      } catch (error) {
        continue;
      }
    }
  }
  
  return null;
}

async function transcribeAudioWithWhisper(videoId: string) {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured - cannot transcribe audio');
  }

  try {
    // Get video audio URL
    const audioUrl = await getVideoAudioUrl(videoId);
    if (!audioUrl) {
      throw new Error('Could not extract audio URL from video');
    }

    console.log('Downloading audio for transcription...');
    
    // Download audio
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error('Failed to download video audio');
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mp4' });

    // Prepare form data for Whisper API
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.mp4');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');

    console.log('Sending audio to Whisper API...');

    // Send to OpenAI Whisper
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      throw new Error(`Whisper API error: ${errorText}`);
    }

    const transcript = await whisperResponse.text();
    
    if (!transcript || transcript.trim().length < 10) {
      throw new Error('Whisper returned empty or very short transcript');
    }

    console.log('Successfully transcribed audio with Whisper, length:', transcript.length);
    return transcript.trim();

  } catch (error) {
    console.error('Whisper transcription error:', error);
    throw new Error(`Audio transcription failed: ${error.message}`);
  }
}

async function getVideoAudioUrl(videoId: string) {
  try {
    // Use yt-dlp style approach to get audio stream URL
    const infoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // This is a simplified approach - in production you might want to use
    // a more robust method to extract audio URLs
    const response = await fetch(infoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch video page');
    }
    
    const pageContent = await response.text();
    
    // Look for audio stream URLs in the page content
    // This is a basic implementation - you might need more sophisticated parsing
    const audioUrlMatch = pageContent.match(/"url":"([^"]*audio[^"]*)"/) || 
                         pageContent.match(/"url":"([^"]*mime=audio[^"]*)"/) ||
                         pageContent.match(/(?:"audioQuality"|"audio")[^}]*"url":"([^"]+)"/);
    
    if (audioUrlMatch && audioUrlMatch[1]) {
      // Decode URL
      return decodeURIComponent(audioUrlMatch[1].replace(/\\u0026/g, '&'));
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting audio URL:', error);
    return null;
  }
}

function extractTextFromTimedText(data: any): string {
  if (!data.events) return '';
  
  let transcript = '';
  
  for (const event of data.events) {
    if (event.segs) {
      for (const seg of event.segs) {
        if (seg.utf8) {
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
    const textMatches = xmlText.match(/<text[^>]*>([^<]+)<\/text>/g);
    if (textMatches) {
      let transcript = '';
      for (const match of textMatches) {
        const textContent = match.replace(/<[^>]*>/g, '').trim();
        if (textContent) {
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
          error: 'Could not extract or generate transcript',
          suggestion: 'This video may not have captions available and audio transcription failed.'
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
