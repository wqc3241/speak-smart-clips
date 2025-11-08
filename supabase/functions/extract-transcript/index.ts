
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { CORS_HEADERS, TranscriptResult } from './types.ts';

async function extractWithSupadata(videoId: string, languageCode?: string): Promise<string | null> {
  const supadataApiKey = Deno.env.get('SUPADATA_API_KEY');
  if (!supadataApiKey) {
    console.error('=== SUPADATA: API key not configured');
    throw new Error('Supadata API key not configured');
  }

  let videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  // Add language parameter if provided
  if (languageCode) {
    videoUrl += `&lang=${languageCode}`;
    console.log('=== SUPADATA: Requesting captions in language:', languageCode);
  }
  
  console.log('=== SUPADATA: Extracting transcript for:', videoUrl);

  try {
    const response = await fetch(`https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(videoUrl)}`, {
      method: 'GET',
      headers: {
        'x-api-key': supadataApiKey,
      },
    });

    console.log('=== SUPADATA: Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('=== SUPADATA: API error:', response.status, errorText);
      
      if (response.status === 404) {
        throw new Error('This video does not have captions available or cannot be accessed');
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a few minutes');
      } else if (response.status === 401 || response.status === 403) {
        throw new Error('API authentication failed');
      }
      
      throw new Error(`Failed to extract transcript: ${response.status}`);
    }

    const data = await response.json();
    console.log('=== SUPADATA: Response received, processing transcript...');

    // Supadata returns transcript in content array with segments
    if (data.content && Array.isArray(data.content)) {
      const transcript = data.content
        .map((segment: any) => segment.text || segment.content || '')
        .filter((text: string) => text.trim().length > 0)
        .join(' ');
      
      console.log('=== SUPADATA: Successfully extracted transcript, length:', transcript.length);
      return transcript;
    }

    console.log('=== SUPADATA: No content found in response');
    return null;
  } catch (error) {
    console.error('=== SUPADATA: Error:', error);
    throw error;
  }
}

async function extractWithWhisper(videoId: string): Promise<{ transcript: string; language: string } | null> {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    console.error('=== WHISPER: API key not configured');
    return null;
  }

  console.log('=== WHISPER: Detecting language for video:', videoId);

  try {
    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/whisper-transcribe`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify({ videoId }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('=== WHISPER: API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();

    if (data.success && data.transcript && data.language) {
      console.log('=== WHISPER: Detected language:', data.language, 'transcript length:', data.transcript.length);
      return {
        transcript: data.transcript,
        language: data.language
      };
    }

    return null;
  } catch (error) {
    console.error('=== WHISPER: Error:', error);
    return null;
  }
}

async function extractTranscript(videoId: string): Promise<string> {
  try {
    console.log('=== Starting transcript extraction for video:', videoId);
    
    // Step 1: Use Whisper to detect language
    let detectedLanguage: string | undefined;
    try {
      const whisperResult = await extractWithWhisper(videoId);
      if (whisperResult) {
        detectedLanguage = whisperResult.language;
        console.log('=== Language detected via Whisper:', detectedLanguage);
        
        // Step 2: Try Supadata with the detected language
        try {
          const supadataTranscript = await extractWithSupadata(videoId, detectedLanguage);
          if (supadataTranscript && supadataTranscript.length > 50) {
            console.log('=== Successfully extracted transcript via Supadata with language:', detectedLanguage);
            return supadataTranscript;
          }
        } catch (supadataError) {
          console.warn('=== Supadata failed, falling back to Whisper transcript:', supadataError);
        }
        
        // Step 3: If Supadata fails, use Whisper's transcript as fallback
        if (whisperResult.transcript && whisperResult.transcript.length > 50) {
          console.log('=== Using Whisper transcript as fallback');
          return whisperResult.transcript;
        }
      }
    } catch (whisperError) {
      console.warn('=== Whisper failed, trying Supadata without language detection:', whisperError);
    }
    
    // Step 4: Final fallback - try Supadata without language parameter
    const transcript = await extractWithSupadata(videoId);
    if (transcript && transcript.length > 50) {
      console.log('=== Successfully extracted transcript via Supadata (no language specified)');
      return transcript;
    }

    throw new Error('Could not extract transcript - no content returned');
  } catch (error) {
    console.error('=== Transcript extraction error:', error);
    throw error;
  }
}

function getVideoTitle(videoId: string): string {
  return `Video ${videoId}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { videoId } = await req.json();

    if (!videoId) {
      throw new Error('Video ID is required');
    }

    console.log('=== Extracting transcript for video ID:', videoId);

    const videoTitle = getVideoTitle(videoId);
    const transcript = await extractTranscript(videoId);
    
    if (!transcript || transcript.length < 50) {
      const result: TranscriptResult = {
        success: false,
        error: 'Please select a video with more than 50 words.',
        suggestion: 'The transcript from this video is too short for analysis. Please try a longer video with substantial spoken content.'
      };

      return new Response(JSON.stringify(result), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const result: TranscriptResult = {
      success: true,
      videoTitle,
      transcript,
      captionsAvailable: true,
      transcriptionMethod: 'supadata'
    };

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in extract-transcript function:', error);
    
    // Determine user-friendly error message and suggestion
    let errorMessage = error.message || 'Failed to extract transcript';
    let suggestion = 'Please check that the video URL is valid and try again.';
    let statusCode = 500;
    
    if (error.message.includes('Rate limit') || error.message.includes('429')) {
      errorMessage = 'Rate limit exceeded. Please try again in a few minutes.';
      suggestion = 'The transcript service is temporarily rate limited. Wait a few minutes and try again.';
      statusCode = 429;
    } else if (error.message.includes('API key') || error.message.includes('authentication')) {
      errorMessage = 'API configuration error';
      suggestion = 'Please contact support - the transcript service is not properly configured.';
    } else if (error.message.includes('captions') || error.message.includes('cannot be accessed')) {
      errorMessage = 'This video does not have captions available.';
      suggestion = 'Please try a different video that has captions or subtitles enabled.';
    }
    
    const result: TranscriptResult = {
      success: false,
      error: errorMessage,
      suggestion
    };

    return new Response(JSON.stringify(result), {
      status: statusCode,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
