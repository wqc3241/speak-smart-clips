
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { CORS_HEADERS, TranscriptResult } from './types.ts';
import { tryYouTubeDataAPI, extractYouTubeSubtitles } from './youtube-scraper.ts';
import { transcribeWithWhisper } from './whisper-transcriber.ts';

async function extractTranscript(videoId: string): Promise<string> {
  try {
    console.log('Starting transcript extraction for video:', videoId);
    
    // First try YouTube Data API if available
    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY');
    if (youtubeApiKey) {
      console.log('Trying YouTube Data API for captions...');
      const transcript = await tryYouTubeDataAPI(videoId, youtubeApiKey);
      if (transcript && transcript.length > 50) {
        console.log('Successfully extracted via YouTube Data API');
        return transcript;
      }
    }

    // Try direct subtitle extraction with improved methods
    console.log('Trying direct subtitle extraction...');
    const subtitleTranscript = await extractYouTubeSubtitles(videoId);
    if (subtitleTranscript && subtitleTranscript.length > 50) {
      console.log('Successfully extracted subtitles');
      return subtitleTranscript;
    }

    // If no subtitles found, use Whisper to transcribe audio
    console.log('No subtitles found, using Whisper to transcribe audio...');
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured. Please add your OpenAI API key to use audio transcription.');
    }

    return await transcribeWithWhisper(videoId, openAIApiKey);
    
  } catch (error) {
    console.error('Transcript extraction error:', error);
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

    console.log('Extracting transcript for video ID:', videoId);

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
