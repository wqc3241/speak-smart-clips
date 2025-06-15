
export function parseSubtitleContent(content: string): string {
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
