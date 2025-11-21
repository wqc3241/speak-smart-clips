
import { USER_AGENT } from './types.ts';

export async function transcribeWithWhisper(videoId: string, openAIApiKey: string): Promise<string> {
  try {
    console.log('Starting Whisper transcription for video:', videoId);
    
    // Get audio stream URL using multiple methods
    const audioUrl = await getYouTubeAudioUrl(videoId);
    
    // Download audio with better error handling
    const audioBuffer = await downloadAudioAsBuffer(audioUrl);
    
    // Create form data for Whisper API
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mp4' });
    formData.append('file', audioBlob, `audio_${videoId}.m4a`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
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
    
    // Try multiple methods to get video page content
    const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const pageResponse = await fetch(videoPageUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    });

    if (!pageResponse.ok) {
      throw new Error(`Failed to fetch video page: ${pageResponse.status}`);
    }

    const pageContent = await pageResponse.text();
    console.log('Page content fetched, length:', pageContent.length);
    
    // Enhanced patterns for finding player response with better matching
    const patterns = [
      // Most common modern pattern
      /"ytInitialPlayerResponse":\s*({.+?})(?=;\s*(?:var|window|if|<\/script))/s,
      // Alternative with quotes
      /ytInitialPlayerResponse":\s*({.+?}),\s*"ytInitialData"/s,
      // Variable assignment patterns
      /var\s+ytInitialPlayerResponse\s*=\s*({.+?})(?=;\s*(?:var|window|if|<\/script))/s,
      /window\["ytInitialPlayerResponse"\]\s*=\s*({.+?})(?=;\s*(?:var|window|if|<\/script))/s,
      // Embedded patterns
      /ytInitialPlayerResponse['"]?\s*[:=]\s*({.+?})(?=[;,\]}])/s
    ];

    let playerResponse = null;
    
    for (const pattern of patterns) {
      const match = pageContent.match(pattern);
      if (match) {
        try {
          let jsonString = match[1];
          
          // Clean up common issues in JSON strings
          jsonString = jsonString.replace(/\\"/g, '"')
                                 .replace(/\\n/g, '')
                                 .replace(/\\t/g, '')
                                 .replace(/\\r/g, '');
          
          // Find the end of the JSON object properly
          let braceCount = 0;
          let endIndex = 0;
          
          for (let i = 0; i < jsonString.length; i++) {
            if (jsonString[i] === '{') braceCount++;
            if (jsonString[i] === '}') braceCount--;
            if (braceCount === 0) {
              endIndex = i + 1;
              break;
            }
          }
          
          if (endIndex > 0) {
            jsonString = jsonString.substring(0, endIndex);
          }
          
          playerResponse = JSON.parse(jsonString);
          console.log('Found player response with pattern:', pattern.source.substring(0, 50) + '...');
          break;
        } catch (parseError) {
          console.log('Failed to parse player response, trying next pattern:', parseError.message);
          continue;
        }
      }
    }

    if (!playerResponse) {
      // Multiple fallback strategies
      const fallbackPatterns = [
        // Look for streamingData directly
        /"streamingData":\s*({[^{}]*(?:{[^{}]*}[^{}]*)*})/g,
        // Look for adaptiveFormats array
        /"adaptiveFormats":\s*(\[[^\]]*\])/g,
        // Look for formats array
        /"formats":\s*(\[[^\]]*\])/g
      ];
      
      for (const fallbackPattern of fallbackPatterns) {
        const matches = [...pageContent.matchAll(fallbackPattern)];
        if (matches.length > 0) {
          try {
            for (const match of matches) {
              const data = JSON.parse(match[1]);
              if (data) {
                if (fallbackPattern.source.includes('streamingData')) {
                  playerResponse = { streamingData: data };
                } else if (fallbackPattern.source.includes('adaptiveFormats')) {
                  playerResponse = { streamingData: { adaptiveFormats: data } };
                } else if (fallbackPattern.source.includes('formats')) {
                  playerResponse = { streamingData: { formats: data } };
                }
                console.log('Found data using fallback pattern:', fallbackPattern.source.substring(0, 30) + '...');
                break;
              }
            }
            if (playerResponse) break;
          } catch (e) {
            console.log('Fallback pattern failed:', e.message);
            continue;
          }
        }
      }
    }

    if (!playerResponse || !playerResponse.streamingData) {
      throw new Error('Could not find streaming data in video page');
    }
    
    const { streamingData } = playerResponse;
    
    if (!streamingData.adaptiveFormats && !streamingData.formats) {
      throw new Error('No adaptive formats or formats found in streaming data');
    }

    // Combine all available formats
    const allFormats = [
      ...(streamingData.adaptiveFormats || []),
      ...(streamingData.formats || [])
    ];

    // Filter for audio-only streams first, then any stream with audio
    const audioFormats = allFormats.filter((format: any) => {
      const mimeType = format.mimeType || '';
      const hasAudio = mimeType.includes('audio') || 
                      (format.audioQuality && !mimeType.includes('video'));
      return hasAudio && format.url;
    });

    if (audioFormats.length === 0) {
      console.log('No audio-only formats found, trying any format with audio');
      const anyAudioFormats = allFormats.filter((format: any) => 
        format.url && (format.audioQuality || format.mimeType?.includes('audio'))
      );
      
      if (anyAudioFormats.length === 0) {
        throw new Error('No formats with audio found');
      }
      
      audioFormats.push(...anyAudioFormats);
    }

    // Prefer formats in this order: m4a, mp4, webm
    const formatPriority = ['mp4', 'm4a', 'webm'];
    const sortedFormats = audioFormats.sort((a: any, b: any) => {
      const aType = a.mimeType || '';
      const bType = b.mimeType || '';
      
      for (const type of formatPriority) {
        if (aType.includes(type) && !bType.includes(type)) return -1;
        if (!aType.includes(type) && bType.includes(type)) return 1;
      }
      
      // Prefer lower quality for faster download
      const aQuality = parseInt(a.audioQuality?.replace('AUDIO_QUALITY_', '') || '999');
      const bQuality = parseInt(b.audioQuality?.replace('AUDIO_QUALITY_', '') || '999');
      return aQuality - bQuality;
    });

    const selectedFormat = sortedFormats[0];
    console.log('Selected audio format:', {
      mimeType: selectedFormat.mimeType,
      audioQuality: selectedFormat.audioQuality,
      contentLength: selectedFormat.contentLength
    });

    return selectedFormat.url;

  } catch (error) {
    console.error('Error extracting audio URL:', error);
    throw new Error(`Failed to extract audio from video: ${error.message}`);
  }
}

async function downloadAudioAsBuffer(audioUrl: string): Promise<ArrayBuffer> {
  try {
    console.log('Downloading audio stream...');
    
    // First, get the content length to determine how much to download
    const headResponse = await fetch(audioUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': USER_AGENT,
      }
    });

    const contentLength = parseInt(headResponse.headers.get('content-length') || '0');
    console.log('Audio content length:', contentLength);

    // Download only first part of the audio to reduce processing time and memory usage
    // Whisper can work with partial audio for transcription
    const maxSize = 15 * 1024 * 1024; // 15MB limit
    const downloadSize = contentLength > 0 ? Math.min(contentLength, maxSize) : maxSize;
    
    const response = await fetch(audioUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Range': `bytes=0-${downloadSize - 1}`,
        'Accept': 'audio/mp4,audio/mpeg,audio/*,*/*',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    console.log(`Downloaded audio buffer: ${audioBuffer.byteLength} bytes`);
    
    if (audioBuffer.byteLength < 1000) {
      throw new Error('Downloaded audio file is too small, likely corrupted');
    }
    
    return audioBuffer;

  } catch (error) {
    console.error('Error downloading audio:', error);
    throw new Error(`Failed to download audio: ${error.message}`);
  }
}
