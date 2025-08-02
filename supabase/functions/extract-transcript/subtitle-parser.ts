
export function parseSubtitleContent(content: string): string {
  try {
    console.log('=== PARSER DEBUG: Starting subtitle parsing, content length:', content.length);
    console.log('=== PARSER DEBUG: Content sample:', content.substring(0, 200));
    
    // Detect content type
    const isJSON = content.trim().startsWith('{') || content.trim().startsWith('[');
    const isVTT = content.includes('WEBVTT') || content.includes('-->');
    const isXML = content.includes('<text') || content.includes('<p>') || content.includes('<?xml');
    const isSRV = content.includes('<timedtext') || content.includes('<transcript');
    
    console.log('=== PARSER DEBUG: Content type detection:', { isJSON, isVTT, isXML, isSRV });
    
    // Try JSON format first (json3)
    if (isJSON) {
      console.log('=== PARSER DEBUG: Attempting JSON parsing...');
      const data = JSON.parse(content);
      console.log('=== PARSER DEBUG: JSON parsed successfully, checking for events...');
      
      if (data.events && data.events.length > 0) {
        console.log('=== PARSER DEBUG: Found events in JSON, count:', data.events.length);
        const transcript = extractTextFromJSON(data);
        console.log('=== PARSER DEBUG: JSON extraction result length:', transcript.length);
        if (transcript.length > 0) return transcript;
      }
      
      // Try alternative JSON structures
      if (data.actions) {
        console.log('=== PARSER DEBUG: Found actions in JSON');
        const transcript = extractTextFromAlternativeJSON(data);
        console.log('=== PARSER DEBUG: Alternative JSON extraction result length:', transcript.length);
        if (transcript.length > 0) return transcript;
      }
    }

    // Try SRV/XML format (YouTube's server format)
    if (isSRV || isXML) {
      console.log('=== PARSER DEBUG: Attempting SRV/XML parsing...');
      const transcript = extractTextFromXML(content);
      console.log('=== PARSER DEBUG: XML extraction result length:', transcript.length);
      if (transcript.length > 0) return transcript;
    }

    // Try VTT format
    if (isVTT) {
      console.log('=== PARSER DEBUG: Attempting VTT parsing...');
      const transcript = extractTextFromVTT(content);
      console.log('=== PARSER DEBUG: VTT extraction result length:', transcript.length);
      if (transcript.length > 0) return transcript;
    }

    // Fallback: try to extract any text content
    console.log('=== PARSER DEBUG: Attempting generic text extraction...');
    const transcript = extractTextFromGeneric(content);
    console.log('=== PARSER DEBUG: Generic extraction result length:', transcript.length);
    return transcript;
    
  } catch (error) {
    console.error('=== PARSER DEBUG: Subtitle parsing error:', error);
    console.error('=== PARSER DEBUG: Content that caused error:', content.substring(0, 500));
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

function extractTextFromAlternativeJSON(data: any): string {
  let transcript = '';
  
  // Handle different JSON structures YouTube might use
  if (data.actions) {
    for (const action of data.actions) {
      if (action.updateEngagementPanelAction?.content?.transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups) {
        const cueGroups = action.updateEngagementPanelAction.content.transcriptRenderer.body.transcriptBodyRenderer.cueGroups;
        for (const cueGroup of cueGroups) {
          if (cueGroup.transcriptCueGroupRenderer?.cues) {
            for (const cue of cueGroup.transcriptCueGroupRenderer.cues) {
              if (cue.transcriptCueRenderer?.cue?.simpleText) {
                transcript += cue.transcriptCueRenderer.cue.simpleText + ' ';
              }
            }
          }
        }
      }
    }
  }
  
  // Handle other possible structures
  if (data.body && data.body.transcriptBodyRenderer) {
    const cueGroups = data.body.transcriptBodyRenderer.cueGroups || [];
    for (const cueGroup of cueGroups) {
      if (cueGroup.transcriptCueGroupRenderer?.cues) {
        for (const cue of cueGroup.transcriptCueGroupRenderer.cues) {
          if (cue.transcriptCueRenderer?.cue?.simpleText) {
            transcript += cue.transcriptCueRenderer.cue.simpleText + ' ';
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
