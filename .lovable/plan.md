

## Use Actual YouTube Video Title for Saved Projects

### Problem
Currently, projects are being saved with the YouTube URL or a placeholder like "Video Lesson - {videoId}" instead of the actual video title. This makes it hard to identify projects in the project list.

### Solution
Fetch the actual video title from the Supadata metadata API before/during transcript extraction and use it as the project title.

### Changes

---

**1. Update `supabase/functions/extract-transcript/index.ts`**

Add a function to fetch video metadata from Supadata and get the real title:

```typescript
async function fetchVideoTitle(videoId: string, supadataApiKey: string): Promise<string> {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(
      `https://api.supadata.ai/v1/metadata?url=${encodeURIComponent(videoUrl)}`,
      {
        method: 'GET',
        headers: { 'x-api-key': supadataApiKey },
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data.title) {
        return data.title;
      }
    }
  } catch (error) {
    console.warn('Failed to fetch video title:', error);
  }
  return `Video ${videoId}`; // Fallback
}
```

Update the main handler to fetch the title before returning:

```typescript
// In the serve handler, before returning:
const supadataApiKey = Deno.env.get('SUPADATA_API_KEY');
const videoTitle = await fetchVideoTitle(videoId, supadataApiKey);
```

---

**2. Update `supabase/functions/poll-transcript-job/index.ts`**

For async jobs, also fetch the video title when the job completes. Pass the videoId to the polling function and fetch metadata.

---

**3. Update `src/hooks/useVideoProcessing.ts`**

The frontend already handles `videoTitle` from the API response - no changes needed if the edge functions return the correct title.

---

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/extract-transcript/index.ts` | Add `fetchVideoTitle()` function and use it to get real video title |
| `supabase/functions/poll-transcript-job/index.ts` | Accept videoId, fetch real title when job completes |

### Result
- New projects will display the actual YouTube video title (e.g., "Learn Japanese with Anime")
- Existing projects will keep their current titles (no retroactive change)
- Fallback to "Video {videoId}" if metadata fetch fails

