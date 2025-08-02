
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { CORS_HEADERS, TranscriptResult } from './types.ts';
import { tryYouTubeDataAPI, extractYouTubeSubtitles } from './youtube-scraper.ts';
import { transcribeWithWhisper } from './whisper-transcriber.ts';

async function extractTranscript(videoId: string): Promise<string> {
  try {
    console.log('=== DEBUG: Starting transcript extraction for video:', videoId);
    console.log('=== DEBUG: Video URL would be: https://www.youtube.com/watch?v=' + videoId);
    
    // Test with known working English video first if this is the problematic video
    const testVideoIds = ['dQw4w9WgXcQ', 'jNQXAC9IVRw', 'L_jWHffIx5E']; // Known English videos with captions
    const isTestVideo = testVideoIds.includes(videoId);
    
    if (isTestVideo) {
      console.log('=== DEBUG: Testing with known English video that should have captions');
    } else {
      console.log('=== DEBUG: Processing user-provided video:', videoId);
    }
    
    // First try YouTube Data API if available
    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY');
    if (youtubeApiKey) {
      console.log('=== DEBUG: Trying YouTube Data API for captions...');
      const transcript = await tryYouTubeDataAPI(videoId, youtubeApiKey);
      if (transcript && transcript.length > 50) {
        console.log('=== DEBUG: Successfully extracted via YouTube Data API, length:', transcript.length);
        return transcript;
      } else {
        console.log('=== DEBUG: YouTube Data API returned empty or short transcript');
      }
    } else {
      console.log('=== DEBUG: No YouTube API key configured, skipping Data API');
    }

    // Try direct subtitle extraction with comprehensive debugging
    console.log('=== DEBUG: Trying direct subtitle extraction...');
    const subtitleTranscript = await extractYouTubeSubtitles(videoId);
    if (subtitleTranscript && subtitleTranscript.length > 50) {
      console.log('=== DEBUG: Successfully extracted subtitles, length:', subtitleTranscript.length);
      console.log('=== DEBUG: Subtitle preview:', subtitleTranscript.substring(0, 200) + '...');
      return subtitleTranscript;
    } else {
      console.log('=== DEBUG: Direct subtitle extraction failed or returned short content');
      console.log('=== DEBUG: Subtitle result length:', subtitleTranscript?.length || 0);
    }

    // If no subtitles found, use Whisper to transcribe audio
    console.log('=== DEBUG: No subtitles found, attempting Whisper audio transcription...');
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.log('=== DEBUG: No OpenAI API key configured');
      throw new Error('OpenAI API key not configured. Please add your OpenAI API key to use audio transcription.');
    }

    console.log('=== DEBUG: Starting Whisper transcription...');
    return await transcribeWithWhisper(videoId, openAIApiKey);
    
  } catch (error) {
    console.error('=== DEBUG: Transcript extraction error:', error);
    console.error('=== DEBUG: Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack?.substring(0, 500)
    });
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
    const { videoId, testMode } = await req.json();

    if (!videoId) {
      throw new Error('Video ID is required');
    }

    console.log('=== DEBUG: Extracting transcript for video ID:', videoId);
    console.log('=== DEBUG: Test mode enabled:', !!testMode);
    
    // If test mode, try with known working videos first
    if (testMode) {
      console.log('=== DEBUG: Test mode - trying known working English videos first');
      const testVideoIds = ['dQw4w9WgXcQ', 'jNQXAC9IVRw', 'L_jWHffIx5E'];
      
      for (const testId of testVideoIds) {
        try {
          console.log('=== DEBUG: Testing with video:', testId);
          const testTranscript = await extractTranscript(testId);
          if (testTranscript && testTranscript.length > 50) {
            console.log('=== DEBUG: ✅ Test video worked! Method is functional.');
            console.log('=== DEBUG: Now trying original video:', videoId);
            break;
          }
        } catch (error) {
          console.log('=== DEBUG: ❌ Test video failed:', testId, error.message);
        }
      }
    }

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
      transcriptionMethod: transcript.includes('transcribed') ? 'whisper' : 'captions'
    };

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in extract-transcript function:', error);
    
    const result: TranscriptResult = {
      success: false,
      error: error.message || 'Failed to extract transcript',
      suggestion: error.message.includes('API key') ? 
        'Please configure your OpenAI API key in the project settings.' : 
        'Please check that the video URL is valid and try again.'
    };

    return new Response(JSON.stringify(result), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
