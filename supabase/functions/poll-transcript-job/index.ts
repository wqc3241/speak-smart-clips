import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const supadataApiKey = Deno.env.get('SUPADATA_API_KEY');
    if (!supadataApiKey) {
      throw new Error('Supadata API key not configured');
    }

    // Validate input
    const requestSchema = z.object({
      jobId: z.string()
    });
    
    const { jobId } = requestSchema.parse(await req.json());
    console.log('=== POLL: Checking job status for:', jobId);

    // Make single GET request to check job status
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
    console.log('=== POLL: Job status:', data.status);

    // Return current status
    if (data.status === 'completed') {
      return new Response(JSON.stringify({
        status: 'completed',
        transcript: data.content,
        videoTitle: `Video Lesson`
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    } else if (data.status === 'failed') {
      const errorDetail = data.error || data.message || 'Unknown error';
      return new Response(JSON.stringify({
        status: 'failed',
        error: `Transcript generation failed: ${errorDetail}`
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    } else {
      // Status is 'queued', 'active', or 'processing'
      return new Response(JSON.stringify({
        status: data.status === 'active' ? 'processing' : 'pending'
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in poll-transcript-job function:', error);
    const errorObj = error as Error;
    
    return new Response(JSON.stringify({
      status: 'failed',
      error: errorObj.message || 'Failed to poll job status'
    }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
