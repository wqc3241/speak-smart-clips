
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

    // Try direct subtitle extraction
    console.log('Trying direct subtitle extraction...');
    const subtitleTranscript = await extractYouTubeSubtitles(videoId);
    if (subtitleTranscript && subtitleTranscript.length > 50) {
      console.log('Successfully extracted subtitles');
      return subtitleTranscript;
    }

    // If no subtitles found, try Whisper as fallback
    console.log('No subtitles found, trying Whisper fallback...');
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('No captions available and OpenAI API key not configured');
    }

    return await transcribeWithWhisper(videoId, openAIApiKey);
    
  } catch (error) {
    console.error('Transcript extraction error:', error);
    throw error;
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!pageResponse.ok) {
      throw new Error(`Failed to fetch video page: ${pageResponse.status}`);
    }

    const pageContent = await pageResponse.text();
    
    // Extract caption tracks from the page
    const captionTracks = extractCaptionTracksFromPage(pageContent);
    
    if (captionTracks.length > 0) {
      console.log(`Found ${captionTracks.length} caption tracks`);
      
      // Try each caption track
      for (const track of captionTracks) {
        try {
          const transcript = await fetchCaptionTrack(track.baseUrl);
          if (transcript && transcript.length > 50) {
            return transcript;
          }
        } catch (error) {
          console.log(`Failed to fetch track ${track.languageCode}:`, error.message);
          continue;
        }
      }
    }

    // Fallback: Try direct timedtext API calls
    console.log('Trying direct timedtext API...');
    return await tryDirectTimedTextAPI(videoId);
    
  } catch (error) {
    console.error('YouTube subtitle extraction error:', error);
    return null;
  }
}

function extractCaptionTracksFromPage(pageContent: string) {
  const tracks = [];
  
  try {
    // Look for caption tracks in various formats
    const patterns = [
      /"captionTracks":\s*(\[.*?\])/,
      /"automaticCaptions":\s*({.*?})/,
      /"playerCaptionsTracklistRenderer".*?"captionTracks":\s*(\[.*?\])/
    ];

    for (const pattern of patterns) {
      const match = pageContent.match(pattern);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          
          if (Array.isArray(data)) {
            // Direct caption tracks array
            for (const track of data) {
              if (track.baseUrl) {
                tracks.push({
                  baseUrl: track.baseUrl,
                  languageCode: track.languageCode || 'unknown',
                  name: track.name?.simpleText || 'Manual'
                });
              }
            }
          } else if (typeof data === 'object') {
            // Automatic captions object
            for (const [lang, trackList] of Object.entries(data)) {
              if (Array.isArray(trackList)) {
                for (const track of trackList) {
                  if (track.baseUrl) {
                    tracks.push({
                      baseUrl: track.baseUrl,
                      languageCode: lang,
                      name: 'Auto-generated'
                    });
                  }
                }
              }
            }
          }
        } catch (parseError) {
          console.log('Failed to parse caption data:', parseError);
          continue;
        }
      }
    }
  } catch (error) {
    console.log('Error extracting caption tracks:', error);
  }

  // Sort tracks by preference
  tracks.sort((a, b) => {
    if (a.name.includes('Auto') && !b.name.includes('Auto')) return 1;
    if (!a.name.includes('Auto') && b.name.includes('Auto')) return -1;
    if (a.languageCode === 'en' && b.languageCode !== 'en') return -1;
    if (a.languageCode !== 'en' && b.languageCode === 'en') return 1;
    return 0;
  });

  return tracks;
}

async function fetchCaptionTrack(baseUrl: string) {
  try {
    const url = baseUrl.replace(/\\u0026/g, '&') + '&fmt=vtt';
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/vtt, application/x-subrip, text/plain, */*',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const content = await response.text();
    return parseSubtitleContent(content);
    
  } catch (error) {
    console.log('Failed to fetch caption track:', error.message);
    return null;
  }
}

async function tryDirectTimedTextAPI(videoId: string) {
  const languages = ['en', 'auto'];
  const formats = ['vtt', 'srv3', 'json3'];
  
  for (const lang of languages) {
    for (const fmt of formats) {
      try {
        const url = `https://www.youtube.com/api/timedtext?lang=${lang}&v=${videoId}&fmt=${fmt}&tlang=en`;
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Referer': `https://www.youtube.com/watch?v=${videoId}`,
          }
        });
        
        if (response.ok) {
          const content = await response.text();
          
          if (content && content.trim().length > 10) {
            const transcript = parseSubtitleContent(content);
            if (transcript && transcript.length > 50) {
              console.log(`Found transcript via direct API: ${lang} ${fmt}`);
              return transcript;
            }
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
    // Try JSON format first
    if (content.trim().startsWith('{')) {
      const data = JSON.parse(content);
      if (data.events && data.events.length > 0) {
        return extractTextFromJSON(data);
      }
    }

    // Try VTT format
    if (content.includes('WEBVTT')) {
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
            if (text) {
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
  
  for (const line of lines) {
    // Skip VTT headers and timestamp lines
    if (line.startsWith('WEBVTT') || 
        line.includes('-->') || 
        line.trim() === '' ||
        /^\d+$/.test(line.trim())) {
      continue;
    }
    
    const cleanLine = line.replace(/<[^>]*>/g, '').trim();
    if (cleanLine) {
      transcript += cleanLine + ' ';
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
            .replace(/&#39;/g, "'");
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
    .replace(/\s+/g, ' ')
    .trim();
    
  return cleaned;
}

async function transcribeWithWhisper(videoId: string, openAIApiKey: string) {
  try {
    console.log('Using Whisper API as fallback...');
    
    // For now, return a helpful message instead of trying to extract audio
    // since YouTube's audio extraction is complex and often blocked
    throw new Error('This video does not have accessible captions. Please try a video with captions enabled, or use a different video.');

  } catch (error) {
    console.error('Whisper transcription error:', error);
    throw error;
  }
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
          suggestion: 'This video may not have captions available. Please try a different video with captions enabled.'
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
        captionsAvailable: true
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
        suggestion: error.message.includes('captions') ? 
          'Please try a video with captions enabled.' : 
          'Please check that the video URL is valid and try again.'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
