# CLAUDE.md

## Workflow Orchestration

### 1. Plan Node Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately – don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes – don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests – then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

## Project Quick Reference

### Key Architecture Decisions
- **STT**: Always use `useWhisperSTT` (OpenAI Whisper via AudioManager). Never use native `useSpeechRecognition` — it's broken on iOS WebKit after TTS playback.
- **TTS**: Always use `useTextToSpeech` (OpenAI gpt-4o-mini-tts via `generate-speech` edge function). Never use native `speechSynthesis` — it sounds robotic.
- **AudioManager** (`src/lib/audioManager.ts`): Singleton that manages mic via `getUserMedia`. Uses `track.enabled` for soft-pause (never `track.stop()` mid-conversation). Must call `refreshStream()` after any TTS playback on iOS.
- **Silence Detection**: Configurable per context — `startCapture(onSilence, { silenceDurationMs, noSpeechTimeoutMs })`. Talk mode: 1.5s/8s. Read After Me: 2.5s/15s.
- **AI Output Sanitization**: `generate-learning-units` edge function always sanitizes AI output (garbled JSON artifacts from Gemini). If adding new question fields, add them to the sanitizer too.

### iOS WebKit Gotchas (CRITICAL)
1. `AudioContext.resume()` is async — MUST await before AnalyserNode works
2. TTS via HTMLAudioElement switches hardware audio session to "playback" — mic stream produces silence after
3. `track.readyState === 'live'` does NOT mean the track captures real audio on iOS
4. Never call `track.stop()` + `getUserMedia()` mid-conversation — causes 40s mediaserverd lock
5. `SpeechRecognition` API has unfixable audio pipeline bug after `<audio>` playback

### Test Structure
All tests in `src/test/` (NOT co-located `__tests__` dirs):
```
src/test/
  setup.ts, mocks/supabase.ts
  unit/{components,hooks,lib,pages}/  — Vitest unit tests
  integration/                        — E2E integration tests
  manual/test-cases.md                — 12 manual regression test cases
```
Run: `npm test` (vitest run) or `npm run test:watch` (vitest)

### Supabase Deployment
```bash
SUPABASE_ACCESS_TOKEN=<token> npx supabase functions deploy <function-name> --project-ref evmamwdmwogmlezndueg
```

### Mobile Testing
Dev server: `npm run dev -- --port 8080 --host`
Tunnel: `ngrok http 8080` → add ngrok URL to Supabase Redirect URLs

### Files Modified Most Often
- `src/lib/audioManager.ts` — Core audio capture (iOS-sensitive)
- `src/hooks/useWhisperSTT.ts` — Whisper STT integration
- `src/hooks/useConversation.ts` — Conversation orchestration
- `supabase/functions/generate-learning-units/index.ts` — Quiz generation + sanitization
- `src/components/features/learning/questions/ReadAfterMeQ.tsx` — Read aloud quiz
- `src/components/features/learning/questions/ListeningQ.tsx` — Listening quiz
