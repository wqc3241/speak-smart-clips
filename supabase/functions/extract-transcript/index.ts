
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { CORS_HEADERS, TranscriptResult } from './types.ts';

async function extractWithSupadata(videoId: string, languageCode?: string): Promise<string | null> {
  const supadataApiKey = Deno.env.get('SUPADATA_API_KEY');
  if (!supadataApiKey) {
    console.error('=== SUPADATA: API key not configured');
    throw new Error('Supadata API key not configured');
  }

  // Build YouTube URL
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  // Always use the standard /v1/transcript endpoint with optional lang parameter
  let apiUrl = `https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(videoUrl)}`;
  
  // Add language parameter if specified
  if (languageCode) {
    apiUrl += `&lang=${languageCode}`;
    console.log('=== SUPADATA: Requesting transcript in language:', languageCode);
  } else {
    console.log('=== SUPADATA: Requesting transcript in default language');
  }
  
  // Add text=true to get plain text response instead of timestamped chunks
  apiUrl += `&text=true`;
  
  console.log('=== SUPADATA: API URL:', apiUrl);

  // Polling configuration for 202 responses
  const maxRetries = 10;
  const retryDelayMs = 2000; // 2 seconds between retries

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'x-api-key': supadataApiKey,
        },
      });

      console.log(`=== SUPADATA: Response status: ${response.status} (attempt ${attempt + 1}/${maxRetries})`);

      // Handle 202 Accepted - transcript is being processed
      if (response.status === 202) {
        console.log('=== SUPADATA: Transcript is being processed, will retry...');
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
          continue; // Retry
        } else {
          throw new Error('Transcript is still being processed. Please try again in a moment.');
        }
      }

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

      // Handle both response formats from Supadata
      let transcript: string;
      
      if (typeof data.content === 'string') {
        // When text=true or direct string response
        transcript = data.content;
      } else if (data.content && Array.isArray(data.content)) {
        // When text=false, content is array of segments
        transcript = data.content
          .map((segment: any) => segment.text || segment.content || '')
          .filter((text: string) => text.trim().length > 0)
          .join(' ');
      } else {
        console.log('=== SUPADATA: No content found in response');
        if (attempt < maxRetries - 1) {
          console.log('=== SUPADATA: Will retry to fetch content...');
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
          continue;
        }
        return null;
      }
      
      console.log('=== SUPADATA: Successfully extracted transcript, length:', transcript.length);
      return transcript;
    } catch (error) {
      if (attempt === maxRetries - 1) {
        console.error('=== SUPADATA: Error after all retries:', error);
        throw error;
      }
      console.log(`=== SUPADATA: Error on attempt ${attempt + 1}, will retry:`, error.message);
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }

  return null;
}

async function extractTranscript(videoId: string, languageCode?: string): Promise<string> {
  try {
    console.log('=== Starting transcript extraction for video:', videoId, 'language:', languageCode || 'auto');
    
    // Try Supadata API with language code
    const transcript = await extractWithSupadata(videoId, languageCode);
    
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
    // Validate input
    const requestSchema = z.object({
      videoId: z.string().regex(/^[a-zA-Z0-9_-]{11}$/, 'Invalid YouTube video ID format'),
      languageCode: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Invalid language code format').optional()
    });
    
    const { videoId, languageCode } = requestSchema.parse(await req.json());

    console.log('=== Extracting transcript for video ID:', videoId, 'language:', languageCode || 'auto');

    const videoTitle = getVideoTitle(videoId);
    const transcript = await extractTranscript(videoId, languageCode);
    
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
    } else if (error.message.includes('still being processed')) {
      errorMessage = 'Transcript is still being generated.';
      suggestion = 'This video\'s transcript is being processed by YouTube. Please wait 30 seconds and try again.';
      statusCode = 202;
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
