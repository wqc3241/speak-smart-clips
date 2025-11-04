
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { CORS_HEADERS, TranscriptResult } from './types.ts';

async function extractWithSupadata(videoId: string): Promise<string | null> {
  const supadataApiKey = Deno.env.get('SUPADATA_API_KEY');
  if (!supadataApiKey) {
    console.error('=== SUPADATA: API key not configured');
    throw new Error('Supadata API key not configured');
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
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

async function extractTranscript(videoId: string): Promise<string> {
  try {
    console.log('=== Starting transcript extraction for video:', videoId);
    
    // Try Supadata API first
    const transcript = await extractWithSupadata(videoId);
    
    if (transcript && transcript.length > 50) {
      console.log('=== Successfully extracted transcript via Supadata');
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
    
    if (!transcript || transcript.length < 10) {
      const result: TranscriptResult = {
        success: false,
        error: 'Could not extract transcript from this video',
        suggestion: 'This video may not have captions available or may not be accessible for transcription. Please try a different video.'
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
