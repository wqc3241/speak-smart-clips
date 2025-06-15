import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function extractTranscript(videoId: string) {
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

async function getYouTubeAudioUrl(videoId: string): Promise<string> {
  try {
    console.log('Fetching YouTube video info for audio extraction...');
    
    // Get video page to extract audio stream URLs
    const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const pageResponse = await fetch(videoPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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

async function transcribeWithWhisper(videoId: string, openAIApiKey: string) {
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

async function tryYouTubeDataAPI(videoId: string, apiKey: string) {
  try {
    // Get video details first
    const videoResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`
    );
    
    if (!videoResponse.ok) {
      throw new Error('Failed to fetch video details');
    }

    // Try to get captions list
    const captionsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`
    );
    
    if (!captionsResponse.ok) {
      console.log('No captions available via YouTube Data API');
      return null;
    }

    const captionsData = await captionsResponse.json();
    if (!captionsData.items || captionsData.items.length === 0) {
      console.log('No caption tracks found');
      return null;
    }

    // Try to download the first available caption
    const captionId = captionsData.items[0].id;
    const downloadResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/captions/${captionId}?key=${apiKey}`,
      {
        headers: {
          'Accept': 'text/vtt, application/x-subrip, text/plain'
        }
      }
    );

    if (downloadResponse.ok) {
      const content = await downloadResponse.text();
      return parseSubtitleContent(content);
    }

    return null;
  } catch (error) {
    console.log('YouTube Data API failed:', error.message);
    return null;
  }
}

async function extractYouTubeSubtitles(videoId: string) {
  try {
    console.log('Fetching video page for subtitle tracks...');
    const videoPageUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    const pageResponse = await fetch(videoPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!pageResponse.ok) {
      throw new Error(`Failed to fetch video page: ${pageResponse.status}`);
    }

    const pageContent = await pageResponse.text();
    
    // Extract caption tracks from the page using improved patterns
    const captionTracks = extractCaptionTracksFromPage(pageContent);
    
    if (captionTracks.length > 0) {
      console.log(`Found ${captionTracks.length} caption tracks`);
      
      // Try each caption track, prioritizing auto-generated ones
      for (const track of captionTracks) {
        try {
          console.log(`Trying caption track: ${track.languageCode} (${track.name})`);
          const transcript = await fetchCaptionTrack(track.baseUrl);
          if (transcript && transcript.length > 50) {
            console.log(`Successfully extracted transcript from ${track.languageCode} track`);
            return transcript;
          }
        } catch (error) {
          console.log(`Failed to fetch track ${track.languageCode}:`, error.message);
          continue;
        }
      }
    }

    // Enhanced fallback: Try direct timedtext API with more options
    console.log('Trying enhanced direct timedtext API...');
    return await tryEnhancedTimedTextAPI(videoId);
    
  } catch (error) {
    console.error('YouTube subtitle extraction error:', error);
    return null;
  }
}

function extractCaptionTracksFromPage(pageContent: string) {
  const tracks = [];
  
  try {
    // Updated patterns for modern YouTube
    const patterns = [
      // New pattern for ytInitialPlayerResponse
      /"ytInitialPlayerResponse":\s*{[^}]*?"captions":\s*{[^}]*?"playerCaptionsTracklistRenderer":\s*{[^}]*?"captionTracks":\s*(\[[^\]]*?\])/,
      // Pattern for automatic captions
      /"ytInitialPlayerResponse":\s*{[^}]*?"captions":\s*{[^}]*?"playerCaptionsTracklistRenderer":\s*{[^}]*?"audioTracks":\s*\[[^\]]*?\],[^}]*?"captionTracks":\s*(\[[^\]]*?\])/,
      // Legacy patterns with updated structure
      /"captionTracks":\s*(\[[^\]]*?\])/,
      /"automaticCaptions":\s*({[^}]*?})/,
      // Pattern for embedded caption data
      /ytInitialPlayerResponse[^{]*?{[^}]*?"captions"[^}]*?{[^}]*?"captionTracks":\s*(\[[^\]]*?\])/
    ];

    for (const pattern of patterns) {
      const match = pageContent.match(pattern);
      if (match) {
        try {
          console.log('Found caption data with pattern:', pattern.source.substring(0, 50) + '...');
          
          let data;
          if (match[1].startsWith('[')) {
            // Direct caption tracks array
            data = JSON.parse(match[1]);
            if (Array.isArray(data)) {
              for (const track of data) {
                if (track.baseUrl && track.languageCode) {
                  tracks.push({
                    baseUrl: track.baseUrl,
                    languageCode: track.languageCode,
                    name: track.name?.simpleText || track.name?.runs?.[0]?.text || 'Unknown',
                    kind: track.kind || 'captions'
                  });
                }
              }
            }
          } else {
            // Automatic captions object
            data = JSON.parse(match[1]);
            for (const [lang, trackList] of Object.entries(data)) {
              if (Array.isArray(trackList)) {
                for (const track of trackList) {
                  if (track.baseUrl) {
                    tracks.push({
                      baseUrl: track.baseUrl,
                      languageCode: lang,
                      name: 'Auto-generated',
                      kind: 'asr'
                    });
                  }
                }
              }
            }
          }
          
          if (tracks.length > 0) {
            console.log(`Extracted ${tracks.length} caption tracks`);
            break;
          }
        } catch (parseError) {
          console.log('Failed to parse caption data:', parseError.message);
          continue;
        }
      }
    }

    // Additional pattern for finding auto-generated captions specifically
    if (tracks.length === 0) {
      const autoGenPattern = /"automaticCaptions":\s*{([^}]*?)}/;
      const autoMatch = pageContent.match(autoGenPattern);
      if (autoMatch) {
        try {
          // Extract language codes and try to construct URLs
          const languages = autoMatch[1].match(/"([a-z]{2}(-[A-Z]{2})?)"/g);
          if (languages) {
            for (const lang of languages) {
              const cleanLang = lang.replace(/"/g, '');
              tracks.push({
                baseUrl: `https://www.youtube.com/api/timedtext?lang=${cleanLang}&v=${videoId}&fmt=json3&tlang=en`,
                languageCode: cleanLang,
                name: 'Auto-generated (constructed)',
                kind: 'asr'
              });
            }
          }
        } catch (e) {
          console.log('Failed to extract auto-generated caption languages');
        }
      }
    }
  } catch (error) {
    console.log('Error extracting caption tracks:', error);
  }

  // Sort tracks by preference: manual captions first, then auto-generated, English preferred
  tracks.sort((a, b) => {
    // Prefer manual captions over auto-generated
    if (a.kind === 'captions' && b.kind === 'asr') return -1;
    if (a.kind === 'asr' && b.kind === 'captions') return 1;
    
    // Prefer English language
    if (a.languageCode.startsWith('en') && !b.languageCode.startsWith('en')) return -1;
    if (!a.languageCode.startsWith('en') && b.languageCode.startsWith('en')) return 1;
    
    return 0;
  });

  console.log('Caption tracks found:', tracks.map(t => `${t.languageCode} (${t.name})`));
  return tracks;
}

async function fetchCaptionTrack(baseUrl: string) {
  try {
    // Clean up the URL and add format parameter
    const cleanUrl = baseUrl.replace(/\\u0026/g, '&').replace(/\\u003d/g, '=');
    const url = cleanUrl.includes('fmt=') ? cleanUrl : `${cleanUrl}&fmt=json3`;
    
    console.log('Fetching caption from:', url.substring(0, 100) + '...');
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/vtt, application/x-subrip, text/plain, */*',
        'Referer': 'https://www.youtube.com/',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const content = await response.text();
    console.log('Received caption content, length:', content.length);
    
    return parseSubtitleContent(content);
    
  } catch (error) {
    console.log('Failed to fetch caption track:', error.message);
    return null;
  }
}

async function tryEnhancedTimedTextAPI(videoId: string) {
  const languages = ['en', 'en-US', 'en-GB', 'auto'];
  const formats = ['json3', 'vtt', 'srv3'];
  
  for (const lang of languages) {
    for (const fmt of formats) {
      try {
        const baseUrl = `https://www.youtube.com/api/timedtext?lang=${lang}&v=${videoId}&fmt=${fmt}`;
        const variations = [
          baseUrl,
          `${baseUrl}&tlang=en`,
          `${baseUrl}&kind=asr`,
          `${baseUrl}&kind=asr&tlang=en`
        ];
        
        for (const url of variations) {
          try {
            console.log(`Trying direct API: ${url}`);
            
            const response = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://www.youtube.com/',
              }
            });
            
            if (response.ok) {
              const content = await response.text();
              
              if (content && content.trim().length > 50) {
                const transcript = parseSubtitleContent(content);
                if (transcript && transcript.length > 50) {
                  console.log(`Successfully extracted via direct API: ${lang} ${fmt}`);
                  return transcript;
                }
              }
            }
          } catch (error) {
            console.log(`Direct API variation failed: ${error.message}`);
            continue;
          }
        }
      } catch (error) {
        console.log(`Direct API failed for ${lang} ${fmt}:`, error.message);
        continue;
      }
    }
  }
  
  return null;
}

function parseSubtitleContent(content: string): string {
  try {
    // Try JSON format first (json3)
    if (content.trim().startsWith('{')) {
      const data = JSON.parse(content);
      if (data.events && data.events.length > 0) {
        return extractTextFromJSON(data);
      }
    }

    // Try VTT format
    if (content.includes('WEBVTT') || content.includes('-->')) {
      return extractTextFromVTT(content);
    }

    // Try XML format
    if (content.includes('<text') || content.includes('<p>')) {
      return extractTextFromXML(content);
    }

    // Fallback: try to extract any text content
    return extractTextFromGeneric(content);
    
  } catch (error) {
    console.error('Subtitle parsing error:', error);
    return '';
  }
}

function extractTextFromJSON(data: any): string {
  let transcript = '';
  
  if (data.events) {
    for (const event of data.events) {
      if (event.segs) {
        for (const seg of event.segs) {
          if (seg.utf8) {
            const text = seg.utf8.replace(/\n/g, ' ').trim();
            if (text && text !== '\n') {
              transcript += text + ' ';
            }
          }
        }
      }
    }
  }
  
  return transcript.trim();
}

function extractTextFromVTT(content: string): string {
  const lines = content.split('\n');
  let transcript = '';
  let inCue = false;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip VTT headers and empty lines
    if (trimmedLine.startsWith('WEBVTT') || 
        trimmedLine === '' ||
        /^\d+$/.test(trimmedLine)) {
      continue;
    }
    
    // Check if this is a timestamp line
    if (trimmedLine.includes('-->')) {
      inCue = true;
      continue;
    }
    
    // If we're in a cue and this line has content, it's subtitle text
    if (inCue && trimmedLine) {
      const cleanLine = trimmedLine.replace(/<[^>]*>/g, '').trim();
      if (cleanLine) {
        transcript += cleanLine + ' ';
      }
    }
  }
  
  return transcript.trim();
}

function extractTextFromXML(content: string): string {
  const patterns = [
    /<text[^>]*>([^<]+)<\/text>/g,
    /<p[^>]*>([^<]+)<\/p>/g,
  ];

  let transcript = '';
  
  for (const pattern of patterns) {
    const matches = Array.from(content.matchAll(pattern));
    if (matches.length > 0) {
      for (const match of matches) {
        const text = match[1]?.trim();
        if (text && text.length > 2) {
          const decoded = text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ');
          transcript += decoded + ' ';
        }
      }
      
      if (transcript.trim().length > 50) {
        return transcript.trim();
      }
    }
  }
  
  return transcript.trim();
}

function extractTextFromGeneric(content: string): string {
  const cleaned = content
    .replace(/<[^>]*>/g, ' ')
    .replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/g, '')
    .replace(/^\d+$/gm, '')
    .replace(/WEBVTT/g, '')
    .replace(/\s+/g, ' ')
    .trim();
    
  return cleaned;
}

function getVideoTitle(videoId: string): string {
  return `Video ${videoId}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Could not extract transcript from this video',
          suggestion: 'This video may not have captions available or may not be accessible for transcription. Please try a different video.'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoTitle,
        transcript,
        captionsAvailable: true,
        transcriptionMethod: transcript.includes('Whisper') ? 'whisper' : 'captions'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in extract-transcript function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to extract transcript',
        suggestion: error.message.includes('API key') ? 
          'Please configure your OpenAI API key in the project settings.' : 
          'Please check that the video URL is valid and try again.'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
