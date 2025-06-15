import { CaptionTrack, USER_AGENT } from './types.ts';

export async function tryYouTubeDataAPI(videoId: string, apiKey: string): Promise<string | null> {
  try {
    console.log('YouTube Data API: Starting with API key present:', !!apiKey);
    
    // Get video details first
    const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;
    console.log('YouTube Data API: Fetching video details...');
    
    const videoResponse = await fetch(videoUrl);
    console.log('YouTube Data API: Video response status:', videoResponse.status);
    
    if (!videoResponse.ok) {
      const errorText = await videoResponse.text();
      console.log('YouTube Data API: Video request failed:', errorText);
      throw new Error(`Failed to fetch video details: ${videoResponse.status} - ${errorText}`);
    }

    const videoData = await videoResponse.json();
    console.log('YouTube Data API: Video data received:', {
      itemsCount: videoData.items?.length || 0,
      videoTitle: videoData.items?.[0]?.snippet?.title || 'Unknown'
    });

    // Try to get captions list
    const captionsUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`;
    console.log('YouTube Data API: Fetching captions list...');
    
    const captionsResponse = await fetch(captionsUrl);
    console.log('YouTube Data API: Captions response status:', captionsResponse.status);
    
    if (!captionsResponse.ok) {
      const errorText = await captionsResponse.text();
      console.log('YouTube Data API: Captions request failed:', errorText);
      console.log('YouTube Data API: No captions available via API');
      return null;
    }

    const captionsData = await captionsResponse.json();
    console.log('YouTube Data API: Captions data received:', {
      itemsCount: captionsData.items?.length || 0,
      items: captionsData.items?.map(item => ({
        id: item.id,
        language: item.snippet?.language,
        name: item.snippet?.name
      })) || []
    });
    
    if (!captionsData.items || captionsData.items.length === 0) {
      console.log('YouTube Data API: No caption tracks found in response');
      return null;
    }

    // Try to download the first available caption
    const captionId = captionsData.items[0].id;
    const downloadUrl = `https://www.googleapis.com/youtube/v3/captions/${captionId}?key=${apiKey}`;
    console.log('YouTube Data API: Attempting to download caption:', captionId);
    
    const downloadResponse = await fetch(downloadUrl, {
      headers: {
        'Accept': 'text/vtt, application/x-subrip, text/plain'
      }
    });

    console.log('YouTube Data API: Caption download response status:', downloadResponse.status);

    if (downloadResponse.ok) {
      const content = await downloadResponse.text();
      console.log('YouTube Data API: Caption content received, length:', content.length);
      
      const { parseSubtitleContent } = await import('./subtitle-parser.ts');
      const transcript = parseSubtitleContent(content);
      
      if (transcript && transcript.length > 50) {
        console.log('YouTube Data API: Successfully parsed transcript, length:', transcript.length);
        return transcript;
      } else {
        console.log('YouTube Data API: Parsed transcript too short or empty');
      }
    } else {
      const errorText = await downloadResponse.text();
      console.log('YouTube Data API: Caption download failed:', errorText);
    }

    return null;
  } catch (error) {
    console.error('YouTube Data API: Detailed error:', {
      message: error.message,
      name: error.name,
      stack: error.stack?.substring(0, 500) // Truncate stack trace
    });
    return null;
  }
}

export async function extractYouTubeSubtitles(videoId: string): Promise<string | null> {
  try {
    console.log('Fetching video page for subtitle tracks...');
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

function extractCaptionTracksFromPage(pageContent: string): CaptionTrack[] {
  const tracks: CaptionTrack[] = [];
  
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
                for (const track of trackList as any[]) {
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

async function fetchCaptionTrack(baseUrl: string): Promise<string | null> {
  try {
    // Clean up the URL and add format parameter
    const cleanUrl = baseUrl.replace(/\\u0026/g, '&').replace(/\\u003d/g, '=');
    const url = cleanUrl.includes('fmt=') ? cleanUrl : `${cleanUrl}&fmt=json3`;
    
    console.log('Fetching caption from:', url.substring(0, 100) + '...');
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json, text/vtt, application/x-subrip, text/plain, */*',
        'Referer': 'https://www.youtube.com/',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const content = await response.text();
    console.log('Received caption content, length:', content.length);
    
    const { parseSubtitleContent } = await import('./subtitle-parser.ts');
    return parseSubtitleContent(content);
    
  } catch (error) {
    console.log('Failed to fetch caption track:', error.message);
    return null;
  }
}

async function tryEnhancedTimedTextAPI(videoId: string): Promise<string | null> {
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
                'User-Agent': USER_AGENT,
                'Accept': 'application/json, text/plain, */*',
                'Referer': 'https://www.youtube.com/',
              }
            });
            
            if (response.ok) {
              const content = await response.text();
              
              if (content && content.trim().length > 50) {
                const { parseSubtitleContent } = await import('./subtitle-parser.ts');
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
