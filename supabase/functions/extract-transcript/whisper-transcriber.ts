
import { USER_AGENT } from './types.ts';

export async function transcribeWithWhisper(videoId: string, openAIApiKey: string): Promise<string> {
  try {
    console.log('Starting Whisper transcription for video:', videoId);
    
    // Get audio stream URL
    const audioUrl = await getYouTubeAudioUrl(videoId);
    
    // Download audio
    const audioBuffer = await downloadAudioAsBuffer(audioUrl);
    
    // Create form data for Whisper API
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mp4' });
    formData.append('file', audioBlob, `audio_${videoId}.m4a`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // You can make this configurable
    formData.append('response_format', 'text');

    console.log('Sending audio to Whisper API...');
    
    // Send to OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Whisper API error:', errorText);
      throw new Error(`Whisper API error: ${response.status} - ${errorText}`);
    }

    const transcript = await response.text();
    console.log('Whisper transcription completed, length:', transcript.length);
    
    if (!transcript || transcript.trim().length < 10) {
      throw new Error('Whisper returned empty or very short transcript');
    }

    return transcript.trim();

  } catch (error) {
    console.error('Whisper transcription error:', error);
    throw new Error(`Audio transcription failed: ${error.message}`);
  }
}

async function getYouTubeAudioUrl(videoId: string): Promise<string> {
  try {
    console.log('Fetching YouTube video info for audio extraction...');
    
    // Get video page to extract audio stream URLs
    const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const pageResponse = await fetch(videoPageUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!pageResponse.ok) {
      throw new Error(`Failed to fetch video page: ${pageResponse.status}`);
    }

    const pageContent = await pageResponse.text();
    
    // Try multiple patterns for finding player response
    const patterns = [
      /var ytInitialPlayerResponse = ({.*?});/,
      /window\["ytInitialPlayerResponse"\] = ({.*?});/,
      /"ytInitialPlayerResponse":({.*?}),"ytInitialData"/,
      /ytInitialPlayerResponse":\s*({.*?}),\s*"ytInitialData"/
    ];

    let playerResponse = null;
    
    for (const pattern of patterns) {
      const match = pageContent.match(pattern);
      if (match) {
        try {
          playerResponse = JSON.parse(match[1]);
          console.log('Found player response with pattern:', pattern.source);
          break;
        } catch (e) {
          console.log('Failed to parse player response, trying next pattern');
          continue;
        }
      }
    }

    if (!playerResponse) {
      throw new Error('Could not find player response in video page');
    }
    
    if (!playerResponse.streamingData || !playerResponse.streamingData.adaptiveFormats) {
      throw new Error('No streaming data found in video');
    }

    // Find audio-only stream (usually format 140 - m4a audio)
    const audioFormats = playerResponse.streamingData.adaptiveFormats.filter(
      (format: any) => format.mimeType && format.mimeType.includes('audio')
    );

    if (audioFormats.length === 0) {
      throw new Error('No audio streams found');
    }

    // Prefer m4a format, fallback to any audio format
    const preferredFormat = audioFormats.find((format: any) => 
      format.mimeType.includes('mp4') || format.mimeType.includes('m4a')
    ) || audioFormats[0];

    if (!preferredFormat.url) {
      throw new Error('No valid audio URL found');
    }

    console.log('Found audio stream:', preferredFormat.mimeType);
    return preferredFormat.url;

  } catch (error) {
    console.error('Error extracting audio URL:', error);
    throw new Error(`Failed to extract audio from video: ${error.message}`);
  }
}

async function downloadAudioAsBuffer(audioUrl: string): Promise<ArrayBuffer> {
  try {
    console.log('Downloading audio stream...');
    
    const response = await fetch(audioUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Range': 'bytes=0-10485760', // Limit to ~10MB to avoid memory issues
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();
    console.log(`Downloaded audio buffer: ${audioBuffer.byteLength} bytes`);
    
    return audioBuffer;

  } catch (error) {
    console.error('Error downloading audio:', error);
    throw new Error(`Failed to download audio: ${error.message}`);
  }
}
