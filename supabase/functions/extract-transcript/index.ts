
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { CORS_HEADERS, TranscriptResult } from './types.ts';

async function pollJobStatus(jobId: string, supadataApiKey: string): Promise<string> {
  const maxPollingAttempts = 24; // 24 attempts * 5 seconds = 120 seconds max
  const pollingInterval = 5000; // 5 seconds between checks to avoid rate limiting
  
  console.log(`=== SUPADATA: Polling job status for jobId: ${jobId}`);
  
  for (let attempt = 0; attempt < maxPollingAttempts; attempt++) {
    const response = await fetch(`https://api.supadata.ai/v1/transcript/${jobId}`, {
      method: 'GET',
      headers: {
        'x-api-key': supadataApiKey,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to poll job status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`=== SUPADATA: Job status (attempt ${attempt + 1}/${maxPollingAttempts}):`, data.status);
    
    if (data.status === 'completed') {
      console.log('=== SUPADATA: Job completed successfully');
      return data.content; // Return the transcript content
    } else if (data.status === 'failed') {
      throw new Error(data.error || 'Transcript generation failed');
    }
    // Status is 'queued' or 'active', continue polling
    
    if (attempt < maxPollingAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, pollingInterval));
    }
  }
  
  throw new Error('Transcript generation timed out after 2 minutes. This video may require more processing time. Please try again in a few minutes.');
}

async function extractWithSupadata(videoId: string, languageCode?: string): Promise<string | null> {
  const supadataApiKey = Deno.env.get('SUPADATA_API_KEY');
  if (!supadataApiKey) {
    console.error('=== SUPADATA: API key not configured');
    throw new Error('Supadata API key not configured');
  }

  // Build YouTube URL
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  // Build API URL with parameters
  let apiUrl = `https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(videoUrl)}&text=true`;
  
  if (languageCode) {
    apiUrl += `&lang=${languageCode}`;
    console.log('=== SUPADATA: Requesting transcript in language:', languageCode);
  }
  
  console.log('=== SUPADATA: Making initial request to:', apiUrl);

  // Make initial request
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'x-api-key': supadataApiKey,
    },
  });

  console.log(`=== SUPADATA: Response status: ${response.status}`);

  // Handle 202 Accepted - async job created
  if (response.status === 202) {
    const jobData = await response.json();
    console.log('=== SUPADATA: Transcript generation in progress, jobId:', jobData.jobId);
    
    if (!jobData.jobId) {
      throw new Error('No job ID returned from API');
    }
    
    // Poll for job completion
    return await pollJobStatus(jobData.jobId, supadataApiKey);
  }

  // Handle immediate errors
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

  // Handle 200 OK - immediate response
  const data = await response.json();
  console.log('=== SUPADATA: Response received (immediate), processing transcript...');

  // Extract content
  if (typeof data.content === 'string') {
    console.log('=== SUPADATA: Successfully extracted transcript, length:', data.content.length);
    return data.content;
  } else if (data.content && Array.isArray(data.content)) {
    const transcript = data.content
      .map((segment: any) => segment.text || segment.content || '')
      .filter((text: string) => text.trim().length > 0)
      .join(' ');
    console.log('=== SUPADATA: Successfully extracted transcript, length:', transcript.length);
    return transcript;
  }
  
  console.log('=== SUPADATA: No content found in response');
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
    } else if (error.message.includes('timed out')) {
      errorMessage = 'Transcript generation is taking longer than expected.';
      suggestion = 'This video requires AI transcript generation which is still processing. Please wait 1-2 minutes and try again.';
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
