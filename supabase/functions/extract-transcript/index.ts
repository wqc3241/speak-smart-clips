
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
    console.log('Attempting to find existing captions...');
    const existingTranscript = await tryExistingCaptions(videoId);
    if (existingTranscript) {
      console.log('Found existing captions, length:', existingTranscript.length);
      return existingTranscript;
    }

    // Method 2: Try alternative caption sources
    console.log('Trying alternative caption sources...');
    const altTranscript = await tryAlternativeCaptions(videoId);
    if (altTranscript) {
      console.log('Found alternative captions, length:', altTranscript.length);
      return altTranscript;
    }

    // Method 3: Use Whisper API for audio transcription
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      throw new Error('No captions found and OpenAI API key not configured');
    }

    console.log('No existing captions found, attempting audio transcription...');
    return await transcribeAudioWithWhisper(videoId, openAIApiKey);
    
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

async function tryAlternativeCaptions(videoId: string) {
  // Try YouTube's automatic captions API
  const altUrls = [
    `https://video.google.com/timedtext?lang=en&v=${videoId}`,
    `https://www.youtube.com/api/timedtext?v=${videoId}&asr_langs=en,es,fr,de,it,pt,ru,ja,ko,zh&caps=asr&exp=xftt,xctts&xorp=true&has_verified=1&sparams=asr_langs,caps,exp,xorp,has_verified&key=yttt1`,
    `https://youtubei.googleapis.com/youtubei/v1/get_transcript?videoId=${videoId}`,
  ];

  for (const url of altUrls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });

      if (response.ok) {
        const text = await response.text();
        if (text && text.length > 50) {
          const parsed = extractTextFromXML(text);
          if (parsed && parsed.length > 50) {
            return parsed;
          }
        }
      }
    } catch (error) {
      console.log(`Alternative caption source failed: ${error.message}`);
      continue;
    }
  }

  return null;
}

async function transcribeAudioWithWhisper(videoId: string, openAIApiKey: string) {
  try {
    // Use yt-dlp style approach to get audio stream
    const audioUrl = await getVideoAudioUrl(videoId);
    if (!audioUrl) {
      // Fallback: try to use a simple audio extraction method
      const fallbackUrl = await getFallbackAudioUrl(videoId);
      if (!fallbackUrl) {
        throw new Error('Could not extract audio URL from video');
      }
    }

    const finalAudioUrl = audioUrl || await getFallbackAudioUrl(videoId);
    console.log('Downloading audio for transcription...');
    
    // Download audio with proper headers and retry logic
    let audioResponse;
    let retries = 3;
    
    while (retries > 0) {
      try {
        audioResponse = await fetch(finalAudioUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
            'Accept-Encoding': 'identity',
            'Range': 'bytes=0-10485760', // Limit to ~10MB for faster processing
          }
        });
        
        if (audioResponse.ok) break;
        
      } catch (error) {
        console.log(`Audio download attempt failed: ${error.message}`);
      }
      
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
      }
    }
    
    if (!audioResponse || !audioResponse.ok) {
      throw new Error(`Failed to download video audio after retries`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    
    // Check if we got actual audio data
    if (audioBuffer.byteLength === 0) {
      throw new Error('Downloaded audio file is empty');
    }
    
    console.log('Audio downloaded successfully, size:', audioBuffer.byteLength, 'bytes');
    
    // Create proper audio file with correct MIME type
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mp3' });

    // Prepare form data for Whisper API
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.mp3');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');
    formData.append('language', 'en'); // You can make this dynamic based on video

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
      console.error('Whisper API error response:', errorText);
      throw new Error(`Whisper API error (${whisperResponse.status}): ${errorText}`);
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
    // Try multiple methods to get video info
    const methods = [
      `https://www.youtube.com/watch?v=${videoId}`,
      `https://www.youtube.com/embed/${videoId}`,
      `https://m.youtube.com/watch?v=${videoId}`,
    ];

    for (const url of methods) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
          }
        });
        
        if (!response.ok) continue;
        
        const pageContent = await response.text();
        
        // Enhanced patterns for finding audio URLs
        const audioUrlPatterns = [
          /"url":"([^"]*audio[^"]*)",/g,
          /"url":"([^"]*mime=audio[^"]*)",/g,
          /(?:"audioQuality"|"audio")[^}]*"url":"([^"]+)"/g,
          /"adaptiveFormats":[^}]*"url":"([^"]*audio[^"]*)"/g,
          /"streamingData"[^{]*{[^}]*"adaptiveFormats"[^[]*\[[^{]*{[^}]*"url":"([^"]*audio[^"]*)"/g,
          /"mimeType":"audio[^"]*"[^}]*"url":"([^"]*)"/g,
        ];
        
        for (const pattern of audioUrlPatterns) {
          let match;
          while ((match = pattern.exec(pageContent)) !== null) {
            if (match[1]) {
              const decodedUrl = decodeURIComponent(match[1].replace(/\\u0026/g, '&').replace(/\\/g, ''));
              if (decodedUrl.includes('audio') || decodedUrl.includes('mime=audio')) {
                console.log('Found potential audio URL');
                return decodedUrl;
              }
            }
          }
        }
      } catch (error) {
        console.log(`Method ${url} failed:`, error.message);
        continue;
      }
    }
    
    console.log('No audio URL found in any method');
    return null;
  } catch (error) {
    console.error('Error extracting audio URL:', error);
    return null;
  }
}

async function getFallbackAudioUrl(videoId: string) {
  // This is a simplified fallback - in reality you might need a more sophisticated approach
  // or use a service that provides direct audio URLs
  try {
    // Try some common YouTube audio stream patterns
    const fallbackUrls = [
      `https://www.youtube.com/api/manifest/dash/id/${videoId}`,
      `https://manifest.googlevideo.com/api/manifest/dash/id/${videoId}`,
    ];

    for (const url of fallbackUrls) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          }
        });

        if (response.ok) {
          const manifest = await response.text();
          // Parse DASH manifest for audio URLs
          const audioMatch = manifest.match(/<Representation[^>]*mimeType="audio[^"]*"[^>]*>[\s\S]*?<BaseURL>([^<]+)<\/BaseURL>/);
          if (audioMatch && audioMatch[1]) {
            return audioMatch[1];
          }
        }
      } catch (error) {
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error('Fallback audio URL extraction failed:', error);
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
    // Handle multiple XML formats
    const patterns = [
      /<text[^>]*>([^<]+)<\/text>/g,
      /<p[^>]*>([^<]+)<\/p>/g,
      /<span[^>]*>([^<]+)<\/span>/g,
      />([\w\s.,!?]+)</g,
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
  // Since we're not using YouTube Data API, return a simple title
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

    // Get video title (simple version without API)
    const videoTitle = getVideoTitle(videoId);
    console.log('Processing video:', videoTitle);

    // Extract transcript using enhanced method
    const transcript = await extractTranscript(videoId);
    
    if (!transcript || transcript.length < 10) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Could not extract or generate transcript',
          suggestion: 'This video may not have captions available and audio transcription failed. Please try a different video or check if the video has captions enabled.'
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
