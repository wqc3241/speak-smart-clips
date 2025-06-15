
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simplified transcript extraction focusing on captions first, then Whisper
async function extractTranscript(videoId: string) {
  try {
    console.log('Attempting to find existing captions...');
    const existingTranscript = await tryExistingCaptions(videoId);
    if (existingTranscript && existingTranscript.length > 50) {
      console.log('Found existing captions, length:', existingTranscript.length);
      return existingTranscript;
    }

    console.log('No existing captions found, using Whisper API...');
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      throw new Error('No captions found and OpenAI API key not configured');
    }

    return await transcribeWithWhisper(videoId, openAIApiKey);
    
  } catch (error) {
    console.error('Transcript extraction error:', error);
    throw error;
  }
}

async function tryExistingCaptions(videoId: string) {
  const formats = ['json3', 'srv3', 'srv2', 'srv1', 'ttml', 'vtt'];
  const languages = ['en', 'auto', 'ja', 'es', 'fr', 'de', 'it', 'ko', 'zh', 'pt', 'ru'];
  
  for (const format of formats) {
    for (const lang of languages) {
      const transcriptUrl = `https://www.youtube.com/api/timedtext?lang=${lang}&v=${videoId}&fmt=${format}`;
      
      try {
        const response = await fetch(transcriptUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': `https://www.youtube.com/watch?v=${videoId}`,
          }
        });
        
        if (response.ok) {
          const responseText = await response.text();
          
          if (responseText && responseText.trim().length > 10) {
            if (format === 'json3') {
              try {
                const data = JSON.parse(responseText);
                if (data.events && data.events.length > 0) {
                  const transcript = extractTextFromTimedText(data);
                  if (transcript && transcript.length > 50) {
                    return transcript;
                  }
                }
              } catch (parseError) {
                console.log('JSON parsing failed, trying XML:', parseError);
              }
            }
            
            const xmlText = extractTextFromXML(responseText);
            if (xmlText && xmlText.length > 50) {
              return xmlText;
            }
          }
        }
      } catch (error) {
        console.log(`Failed to fetch ${format} ${lang}:`, error.message);
        continue;
      }
    }
  }
  
  return null;
}

async function transcribeWithWhisper(videoId: string, openAIApiKey: string) {
  try {
    console.log('Using Whisper API to transcribe audio...');
    
    // Use yt-dlp style approach to get direct audio URL
    const audioUrl = await getAudioStreamUrl(videoId);
    
    if (!audioUrl) {
      throw new Error('Could not find audio stream for this video');
    }

    console.log('Found audio stream, downloading...');
    
    // Download audio with size limit for faster processing
    const audioResponse = await fetch(audioUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Range': 'bytes=0-20971520', // Limit to ~20MB
      }
    });

    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    
    if (audioBuffer.byteLength === 0) {
      throw new Error('Downloaded audio file is empty');
    }
    
    console.log('Audio downloaded, size:', audioBuffer.byteLength, 'bytes');
    
    // Create audio blob for Whisper API
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mp4' });

    // Prepare form data
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.mp4');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');

    console.log('Sending to Whisper API...');

    // Call Whisper API
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('Whisper API error:', errorText);
      throw new Error(`Whisper API error (${whisperResponse.status}): ${errorText}`);
    }

    const transcript = await whisperResponse.text();
    
    if (!transcript || transcript.trim().length < 10) {
      throw new Error('Whisper returned empty transcript');
    }

    console.log('Whisper transcription successful, length:', transcript.length);
    return transcript.trim();

  } catch (error) {
    console.error('Whisper transcription error:', error);
    throw new Error(`Audio transcription failed: ${error.message}`);
  }
}

async function getAudioStreamUrl(videoId: string): Promise<string | null> {
  try {
    // Try multiple video info endpoints
    const infoUrls = [
      `https://www.youtube.com/watch?v=${videoId}`,
      `https://www.youtube.com/embed/${videoId}`,
    ];

    for (const url of infoUrls) {
      try {
        console.log('Trying to extract audio URL from:', url);
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          }
        });
        
        if (!response.ok) continue;
        
        const pageContent = await response.text();
        
        // Look for adaptive formats with audio
        const adaptiveFormatsMatch = pageContent.match(/"adaptiveFormats":\s*(\[.*?\])/);
        if (adaptiveFormatsMatch) {
          try {
            const adaptiveFormats = JSON.parse(adaptiveFormatsMatch[1]);
            
            // Find audio-only stream
            for (const format of adaptiveFormats) {
              if (format.mimeType && format.mimeType.includes('audio') && format.url) {
                const decodedUrl = format.url.replace(/\\u0026/g, '&');
                console.log('Found audio stream URL');
                return decodedUrl;
              }
            }
          } catch (parseError) {
            console.log('Failed to parse adaptive formats:', parseError);
          }
        }
        
        // Fallback: look for any audio URL patterns
        const audioUrlPatterns = [
          /"url":"([^"]*audio[^"]*)",/g,
          /"url":"([^"]*mime=audio[^"]*)",/g,
        ];
        
        for (const pattern of audioUrlPatterns) {
          const matches = pageContent.match(pattern);
          if (matches) {
            for (const match of matches) {
              const urlMatch = match.match(/"url":"([^"]+)"/);
              if (urlMatch) {
                const decodedUrl = decodeURIComponent(urlMatch[1].replace(/\\u0026/g, '&'));
                console.log('Found audio URL via pattern matching');
                return decodedUrl;
              }
            }
          }
        }
        
      } catch (error) {
        console.log(`Failed to get info from ${url}:`, error.message);
        continue;
      }
    }
    
    console.log('No audio stream URL found');
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
    const patterns = [
      /<text[^>]*>([^<]+)<\/text>/g,
      /<p[^>]*>([^<]+)<\/p>/g,
      /<span[^>]*>([^<]+)<\/span>/g,
    ];

    let transcript = '';
    
    for (const pattern of patterns) {
      const matches = Array.from(xmlText.matchAll(pattern));
      if (matches.length > 0) {
        for (const match of matches) {
          const textContent = match[1]?.trim();
          if (textContent && textContent.length > 2) {
            const decoded = textContent
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/&apos;/g, "'");
            transcript += decoded + ' ';
          }
        }
        
        if (transcript.trim().length > 50) {
          return transcript.trim();
        }
      }
    }
    
    return transcript.trim();
  } catch (error) {
    console.error('XML parsing error:', error);
    return '';
  }
}

function getVideoTitle(videoId: string): string {
  return `Video ${videoId}`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoId } = await req.json();

    if (!videoId) {
      throw new Error('Video ID is required');
    }

    console.log('Extracting transcript for video ID:', videoId);

    const videoTitle = getVideoTitle(videoId);
    console.log('Processing video:', videoTitle);

    const transcript = await extractTranscript(videoId);
    
    if (!transcript || transcript.length < 10) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Could not extract or generate transcript',
          suggestion: 'This video may not have captions available and audio transcription failed. Please try a different video.'
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
