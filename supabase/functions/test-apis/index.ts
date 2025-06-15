
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { testType } = await req.json();
    
    if (testType === 'youtube') {
      return await testYouTubeAPI();
    } else if (testType === 'openai') {
      return await testOpenAIAPI();
    } else {
      return await testBothAPIs();
    }
    
  } catch (error) {
    console.error('Error in test-apis function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function testYouTubeAPI() {
  const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY');
  
  if (!youtubeApiKey) {
    return new Response(
      JSON.stringify({
        success: false,
        service: 'youtube',
        error: 'YouTube API key not configured'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Test with a simple API call to get video details
    const testVideoId = 'dQw4w9WgXcQ'; // Rick Roll video - should always exist
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${testVideoId}&key=${youtubeApiKey}`
    );

    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return new Response(
      JSON.stringify({
        success: true,
        service: 'youtube',
        message: 'YouTube API is working correctly',
        data: {
          videoTitle: data.items?.[0]?.snippet?.title || 'No title found',
          apiKeyValid: true
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
    
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        service: 'youtube',
        error: `YouTube API test failed: ${error.message}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

async function testOpenAIAPI() {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openAIApiKey) {
    return new Response(
      JSON.stringify({
        success: false,
        service: 'openai',
        error: 'OpenAI API key not configured'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Test with a simple chat completion
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: 'Say "API test successful" if you can read this.' }
        ],
        max_tokens: 10
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorData}`);
    }

    const data = await response.json();
    
    return new Response(
      JSON.stringify({
        success: true,
        service: 'openai',
        message: 'OpenAI API is working correctly',
        data: {
          response: data.choices?.[0]?.message?.content || 'No response',
          model: data.model,
          apiKeyValid: true
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
    
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        service: 'openai',
        error: `OpenAI API test failed: ${error.message}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

async function testBothAPIs() {
  const youtubeResult = await testYouTubeAPI();
  const openaiResult = await testOpenAIAPI();
  
  const youtubeData = await youtubeResult.json();
  const openaiData = await openaiResult.json();
  
  return new Response(
    JSON.stringify({
      success: youtubeData.success && openaiData.success,
      youtube: youtubeData,
      openai: openaiData,
      summary: {
        youtubeWorking: youtubeData.success,
        openaiWorking: openaiData.success,
        allWorking: youtubeData.success && openaiData.success
      }
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
