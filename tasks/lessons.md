# Lessons Learned

## iOS SpeechRecognition 40-Second Mic Freeze After TTS

**Date**: 2026-02-27
**Severity**: Critical (completely blocked iOS voice input)

### Symptom

On iOS Chrome (all browsers on iOS use WebKit), after AI TTS audio playback via `<audio>` element, calling `SpeechRecognition.start()` would succeed but fail to capture any audio for exactly ~40 seconds. After the timeout, an `audio-capture` error fires, and only then does a retry work. First voice input always worked; second and subsequent inputs after a TTS cycle always froze.

### Root Cause

A fundamental WebKit bug in the `SpeechRecognition` API. After `<audio>` element playback, WebKit's internal audio pipeline fails to transition back to "record" mode. The `onaudiostart` event fires (WebKit *thinks* audio is being captured), but no actual audio data reaches the recognition engine. The 40-second delay is `mediaserverd`'s forced hardware reset timeout.

### What We Tried (All Failed)

1. **Removing AudioContext leaks** — Old `releaseAudioSession()` created a new `AudioContext` each time TTS ended. Fixed the leak, but 40s freeze persisted.
2. **getUserMedia "mic-route ping"** — Acquire and immediately release a `getUserMedia` stream before `recognition.start()`. Mic route was successfully activated (`mic-route ping ok`), but SpeechRecognition still couldn't capture audio.
3. **Instance reuse** — Kept the same `SpeechRecognition` object across start/stop cycles instead of creating new ones. Still froze.
4. **Watchdog retry** — Abort and retry every 3 seconds if `onaudiostart` didn't fire. But `onaudiostart` DID fire (WebKit's lie), so the watchdog never triggered.
5. **Holding a getUserMedia stream (keepAlive)** — iOS's single-audio-capture-source policy meant the held stream conflicted with SpeechRecognition.
6. **Pre-warming mic at conversation start** — Same conflict.

### Solution

Replaced `SpeechRecognition` entirely with `getUserMedia` + OpenAI Whisper API:

- **`src/lib/audioManager.ts`** — Singleton that acquires mic ONCE via `getUserMedia` at conversation start. Uses `track.enabled = false/true` for soft-pause/resume (never calls `track.stop()` during a conversation). Records via `MediaRecorder`. Has silence detection via Web Audio `AnalyserNode`.
- **`supabase/functions/transcribe-audio/index.ts`** — Edge function that receives audio blob, sends to OpenAI Whisper API, returns transcription.
- **`src/hooks/useWhisperSTT.ts`** — Drop-in replacement for `useSpeechRecognition` with the same interface. Uses AudioManager + Whisper edge function.

### Key Lesson

> On iOS WebKit, the `SpeechRecognition` API has an unfixable audio pipeline bug after `<audio>` playback. No amount of JavaScript-level workarounds (AudioContext management, getUserMedia tricks, instance reuse, retry loops) can fix it because the bug is inside WebKit's internal C++ audio routing. The only reliable solution is to bypass `SpeechRecognition` entirely and use `getUserMedia` + an external STT service.

### Pattern to Remember

- On iOS, **never `track.stop()` a getUserMedia stream mid-conversation** — use `track.enabled = false` instead (soft-pause). Calling `stop()` triggers a ~40s `mediaserverd` hardware lock on re-acquisition.
- On iOS, **`SpeechRecognition` and `getUserMedia` cannot coexist** — only one audio capture source is allowed at a time.

---

## Google OAuth Redirecting to Production Instead of Local Dev

**Date**: 2026-02-27
**Severity**: Blocked local testing on mobile devices

### Symptom

When accessing the dev server at `http://192.168.1.175:8080` from an iOS device and logging in with Google OAuth via Supabase, the user was redirected back to `https://breaklingo.com` (production) instead of the local dev server.

### Root Cause

Supabase's OAuth callback flow does not reliably support `http://` + private IP addresses as redirect URLs. Even though the frontend correctly passed `redirectTo: 'http://192.168.1.175:8080'` and Supabase's Redirect URLs list included it, the OAuth callback fell back to the Site URL (`http://breaklingo.com`).

### Solution

Use **ngrok** to create an HTTPS tunnel to the local dev server:

```bash
ngrok http 8080
```

This provides a public HTTPS URL (e.g., `https://xxx.ngrok-free.dev`) that:
1. Works with Supabase OAuth (HTTPS + public domain)
2. Can be added to Supabase Redirect URLs
3. Tunnels traffic back to `localhost:8080`

### Setup Steps

1. Install: `winget install ngrok.ngrok`
2. Authenticate: `ngrok config add-authtoken <your-token>`
3. Update if needed: `ngrok update`
4. Run: `ngrok http 8080`
5. Add the ngrok URL to Supabase Dashboard > Authentication > URL Configuration > Redirect URLs
6. Access the app via the ngrok URL on mobile

### Key Lesson

> For mobile device testing with OAuth, always use an HTTPS tunnel (ngrok, cloudflared, etc.) rather than raw `http://private-ip:port`. Supabase and most OAuth providers silently reject or ignore HTTP + private IP redirect URLs.

---

## Auto-Detect Video Language (Remove Manual Language Selection)

**Date:** 2026-02-27

### Problem

After selecting a YouTube video, users had to manually choose a language from a dropdown before processing could begin. This was unnecessary friction because the `analyze-content` edge function already detects the language via AI (Gemini), and `extract-transcript` works without a `languageCode` (Supadata's `mode=auto`).

### Changes

| File | What Changed |
|------|-------------|
| `src/components/dashboard/InputTab.tsx` | Removed language selector UI, all related state, and the language code map. Clicking a video now immediately calls `onProcessVideo(videoId)`. |
| `src/hooks/useVideoProcessing.ts` | Removed `languageCode` and `selectedLanguageName` from `processVideo` signature. Language is now always AI-detected. |
| `src/pages/Index.tsx` | Simplified `handleProcessVideo(videoId)` — no more language params. |
| `src/test/__tests__/userJourney.integration.test.tsx` | Updated Phase 3 test to verify `extract-transcript` is called immediately on video click (no language selector step). |

### Key Lesson

> The AI analysis already returned `detectedLanguage` — we were just overriding it with user input. Removing the override simplified the code significantly. The pending/polling path (`completeProjectProcessing`) already used AI-detected language, so no changes were needed there.

---

## Bilingual Video Support (Native Script for Mixed-Language Content)

**Date:** 2026-02-27

### Problem

For videos where a teacher teaches a foreign language in English (e.g., Japanese lesson taught in English), the transcript from Supadata was auto-generated English captions with romanized foreign words ("Ohayou" instead of "おはよう"). The AI analysis then returned vocabulary and grammar in romanized Latin characters instead of native script.

### Root Cause

Two issues compounding:
1. **Transcript level:** Supadata's `mode=auto` fetched English auto-generated captions, which romanize all foreign words.
2. **AI prompt level:** The prompt didn't explicitly handle bilingual content or instruct conversion from romanized text to native script.

### Changes

| File | What Changed |
|------|-------------|
| `src/hooks/useVideoProcessing.ts` | Added auto-language-selection in `processVideo`: calls `fetchAvailableLanguages()` before `fetchTranscript()`, prefers manual non-English caption tracks over auto-generated English. Falls back silently to auto mode on failure. |
| `supabase/functions/analyze-content/index.ts` | Rewrote system prompt with 5 instructions: (1) Target language detection for bilingual content, (2) Extract vocabulary only from target language, (3) Deduplication, (4) Romanized-to-native-script conversion with examples, (5) Output in native script. Updated tool parameter descriptions accordingly. |

### Key Lesson

> **Prompt changes alone are insufficient** when the input data is already degraded. The transcript was entirely in Latin characters, so no amount of prompting could reliably produce native script output. Fixing the input (native caption track) was essential. Defense in depth: fix both the input (prefer native captions) AND the AI prompt (handle romanized fallback), since native captions aren't always available.

### Pattern to Remember

- The `get-available-languages` edge function was already implemented but unused in the auto-flow — reusing existing infrastructure avoided building new endpoints.
- When the AI receives romanized input, it needs **explicit examples** of the conversion (e.g., "Ohayou" → おはよう) to reliably output native script.

---

## Cache Personalized Recommendations (Reduce YouTube API Quota Usage)

**Date:** 2026-02-27

### Problem

The `usePersonalizedRecommendations` hook called `youtube-search` (3 parallel API calls) every time the Input tab mounted. This consumed YouTube search quota on every tab switch or page refresh, even when the results hadn't changed.

### Root Cause

- The `fetchedKeyRef` prevented re-fetching within the same mount lifecycle, but was reset on every remount.
- Recommendations were not persisted anywhere — always fetched fresh from the YouTube API.

### Changes

| File | What Changed |
|------|-------------|
| `src/hooks/usePersonalizedRecommendations.ts` | Added per-account localStorage caching with 24-hour TTL. Cache key is `speak-smart-clips:recommendations:{userId}`. On mount: check cache validity (same queriesKey + not expired) → serve from cache. On miss: fetch from API → save to cache. |

### Cache Behavior

- **Key:** `speak-smart-clips:recommendations:{userId}` — per-account, not shared across users on same device.
- **Invalidation:** Cache is invalidated when (a) search history changes (different `queriesKey`), or (b) cache is older than 24 hours.
- **Quota savings:** Typical user saves 3 API calls per page load / tab switch. Only pays quota cost once per day or when search history changes.

### Key Lesson

> Static/curated recommendations (hardcoded in `recommendedVideos.ts`) never call the API — only personalized recommendations did. Clicking a recommended video already went directly to `processVideo(videoId)` without any search API call. The quota drain was entirely from populating the recommendation grid. localStorage with user-specific keys is a simple, effective cache — no DB schema changes needed.

---

## YouTube API Key Rotation on Quota Exceeded

**Date:** 2026-02-27

### Problem

The YouTube Data API v3 has a daily quota limit per project. With a single API key, once the quota was exhausted, all search functionality (user searches + personalized recommendations) stopped working until the next day.

### Changes

| File | What Changed |
|------|-------------|
| `supabase/functions/youtube-search/index.ts` | Refactored to load multiple API keys (`YOUTUBE_API_KEY`, `YOUTUBE_API_KEY_2`, ..., up to `_10`). On each search request, tries keys sequentially. If one returns 403 (quota exceeded), automatically rotates to the next key. Non-quota errors (400, 401, etc.) fail immediately without rotation. |

### Configuration

- API keys are stored as Supabase secrets: `YOUTUBE_API_KEY` (primary), `YOUTUBE_API_KEY_2`, `YOUTUBE_API_KEY_3`, `YOUTUBE_API_KEY_4`
- Each key belongs to a different Google Cloud project, giving independent quotas
- Adding a new key only requires `supabase secrets set YOUTUBE_API_KEY_N=<key>` — no code change needed

### Key Lesson

> Keep the rotation logic in the edge function (server-side), not the client. This way all clients benefit from the failover transparently. Only rotate on 403 quota errors — other HTTP errors (auth failures, bad requests) are not key-specific and should fail fast.

---

## Test Coverage Added (2026-02-27)

### `src/hooks/__tests__/usePersonalizedRecommendations.test.ts` (new file — 8 tests)
- Returns empty when search history is empty (no API calls)
- Fetches via youtube-search when no cache exists
- Serves from cache without API calls when cache is fresh
- Ignores expired cache (>24h) and re-fetches
- Ignores cache when search history changes
- Deduplicates videos across batches
- Saves fetched results to localStorage cache
- Uses only first 3 search history entries (MAX_QUERIES)

### `src/hooks/__tests__/useVideoProcessing.test.ts` (extended — 7 new tests)
- `processVideo` signature has no `languageCode` param
- Calls `get-available-languages` before `extract-transcript`
- Prefers manual non-English captions over auto-generated
- Falls back to auto mode when `get-available-languages` fails
- Falls back to auto mode when only English captions are available
- Uses AI-detected language directly (no manual override)
- Sets `detectedLanguage` to "Detecting..." for pending transcript jobs
