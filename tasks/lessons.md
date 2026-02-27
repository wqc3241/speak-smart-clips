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
