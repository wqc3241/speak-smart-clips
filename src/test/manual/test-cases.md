# Manual Test Cases — Bug Regression Suite

These test cases cover bugs reported and fixed during development. Run them on **iOS Safari/Chrome** (all iOS browsers use WebKit) to verify regressions.

---

## TC-001: Voice Input Detection in Talk Mode (AudioManager Track Health)

**Bug**: Mic permission granted and icon shows listening, but voice input not detected. After 20-30s, browser revokes mic permission.

**Precondition**: Logged in, project with vocabulary exists.

**Steps**:
1. Go to **Talk** tab
2. Start a conversation (tap "Start Conversation")
3. Wait for AI greeting to finish playing
4. The mic should auto-activate for listening
5. Speak a sentence in the target language
6. Observe if the system detects your voice and processes it

**Expected**:
- Voice is detected and transcribed
- AI responds with audio
- No 20-30s freeze or mic permission revocation

**Regression files**: `src/lib/audioManager.ts`, `src/hooks/useWhisperSTT.ts`, `src/hooks/useConversation.ts`

---

## TC-002: iOS AudioContext Suspension — Silence Detection

**Bug**: AudioContext starts suspended on iOS. AnalyserNode reads all zeros, silence detection never triggers, mic stays open indefinitely until browser revokes permission.

**Precondition**: iOS device, logged in, project exists.

**Steps**:
1. Go to **Talk** tab
2. Start conversation
3. After AI speaks, speak a short phrase
4. Stop speaking and wait ~2 seconds

**Expected**:
- Silence detection triggers after ~1.5s of silence
- Recording auto-stops and audio is sent to Whisper for transcription
- User does NOT need to manually stop recording

**What to watch for**:
- If recording never auto-stops, the AudioContext.resume() fix may have regressed
- Check browser console for `[AudioManager]` logs

**Regression files**: `src/lib/audioManager.ts` (setupSilenceDetection — must await AudioContext.resume())

---

## TC-003: iOS TTS Playback Kills Mic Stream

**Bug**: After AI speaks via OpenAI TTS (HTMLAudioElement), the mic stream produces silence because iOS switches the hardware audio session to "playback" mode.

**Precondition**: iOS device, logged in, project exists.

**Steps**:
1. Go to **Talk** tab
2. Start conversation → AI greeting plays via TTS
3. After TTS finishes, speak a response
4. Verify voice is detected
5. Repeat for 3+ turns of conversation

**Expected**:
- Voice is detected on EVERY turn, not just the first
- The mic stream is refreshed after each TTS playback
- No need to refresh the page between turns

**What to watch for**:
- If voice works on turn 1 but not turn 2+, `refreshStream()` may not be called after TTS ends
- Console should show `[AudioManager] Stream refreshed after TTS`

**Regression files**: `src/lib/audioManager.ts` (refreshStream), `src/hooks/useConversation.ts` (whisperRefreshMic after isPlaying→false)

---

## TC-004: Quiz Options — No "interim" or JSON Artifacts

**Bug**: Multiple choice options showed text like "Outside interim,", "Itself interim],question:", containing JSON structure leaked from garbled Gemini AI output.

**Precondition**: Logged in, project with learning units generated.

**Steps**:
1. Go to **Learn** tab
2. Start a quiz for any project
3. Go through all question types (multiple choice, fill-in-the-blank, etc.)
4. Read every option text carefully

**Expected**:
- All option text is clean natural language
- No `interim`, `],question:`, `correctAnswer:`, `type:`, `options:` fragments in any option
- No trailing commas, brackets, or JSON syntax in option text

**Regression files**: `supabase/functions/generate-learning-units/index.ts` (sanitizeOptionText, garbled-option filter)

---

## TC-005: Quiz Options — No "word:" Artifacts in Match Pairs

**Bug**: Match pairs question meanings had "word:" appended to the end (e.g., "beautiful word:").

**Precondition**: Project with match_pairs questions.

**Steps**:
1. Go to **Learn** tab
2. Find a match_pairs question
3. Check all word and meaning cards

**Expected**:
- No "word:" or "meaning:" text appended to any card
- All words and meanings are clean natural language

**Regression files**: `supabase/functions/generate-learning-units/index.ts` (sanitizeOptionText regex for word/meaning patterns)

---

## TC-006: Match Pairs Rendering — Cards Not Empty

**Bug**: Match pairs cards showed empty content with just a "match_pair" badge. Caused by AI generating `type: "match_pair"` (no 's') and `pair` key instead of `pairs`.

**Precondition**: Project with match_pairs questions.

**Steps**:
1. Go to **Learn** tab
2. Navigate to a match_pairs question
3. Verify cards render with actual word/meaning content

**Expected**:
- All cards show word or meaning text
- Cards are tappable and matching works correctly
- No empty/blank cards

**Regression files**: `supabase/functions/generate-learning-units/index.ts` (type normalization: match_pair→match_pairs, pair→pairs)

---

## TC-007: Learning Units — OpenAI TTS (Not Robotic Browser Voice)

**Bug**: "Listen" button in Read After Me and Listening questions used native `speechSynthesis` which sounds robotic.

**Precondition**: Logged in, project with Read After Me or Listening questions.

**Steps**:
1. Go to **Learn** tab
2. Find a **Read After Me** question
3. Tap "Listen" button
4. Find a **Listening** question
5. Tap the speaker button

**Expected**:
- Voice sounds natural (OpenAI TTS), not robotic
- Button shows spinner/loading while audio generates
- Button shows "Playing..." while audio plays
- Tapping again during playback stops it

**Regression files**: `src/components/features/learning/questions/ReadAfterMeQ.tsx`, `src/components/features/learning/questions/ListeningQ.tsx`

---

## TC-008: Read After Me — Voice Detection on First Tap

**Bug**: First tap of the mic button in Read After Me questions didn't detect voice input. Used native `useSpeechRecognition` which is unreliable on iOS.

**Precondition**: iOS device, logged in, project with Read After Me questions.

**Steps**:
1. Go to **Learn** tab
2. Find a **Read After Me** question
3. Tap the mic button (first time)
4. Speak the target text
5. Wait for auto-stop or tap stop

**Expected**:
- Voice is detected on the FIRST tap (no need to retry)
- Recording starts immediately
- After speaking, transcription is processed and similarity result shown

**Regression files**: `src/components/features/learning/questions/ReadAfterMeQ.tsx` (switched to useWhisperSTT)

---

## TC-009: Read After Me — Mic Icon States Are Clear

**Bug**: Mic button showed `MicOff` (crossed-out mic) icon when recording, which looked like "mic is disabled" rather than "currently recording".

**Steps**:
1. Go to **Learn** tab
2. Find a **Read After Me** question
3. Observe the mic button in each state:
   - Before tapping: Should show **Mic icon** + "Tap to speak"
   - While recording: Should show **Square (stop) icon** + "Tap to stop" + red pulsing button + "Recording... Speak now" banner
   - While processing: Should show **Spinner** + "Processing..."

**Expected**:
- Each state is visually distinct and unambiguous
- No `MicOff` icon used during recording

**Regression files**: `src/components/features/learning/questions/ReadAfterMeQ.tsx`

---

## TC-010: Read After Me — Long Sentences Don't Cut Off

**Bug**: For long sentences, the silence detection (1.5s) triggered during natural pauses between words/phrases, cutting off the recording before the user finished speaking.

**Precondition**: Project with long Read After Me sentences (10+ characters in target language).

**Steps**:
1. Find a **Read After Me** question with a long sentence
2. Tap mic button
3. Speak the full sentence at a natural pace (including brief pauses between phrases)
4. Finish the sentence and wait for auto-stop

**Expected**:
- Recording does NOT stop during natural pauses (up to ~2.5 seconds)
- Recording auto-stops after 2.5 seconds of complete silence
- Full sentence is captured and transcribed
- No-speech timeout is 15 seconds (enough time to read before speaking)

**Regression files**: `src/lib/audioManager.ts` (configurable silenceDurationMs/noSpeechTimeoutMs), `src/components/features/learning/questions/ReadAfterMeQ.tsx` (silenceDurationMs: 2500, noSpeechTimeoutMs: 15000)

---

## TC-011: AudioManager — Dead Track Recovery

**Bug**: After OS sleep/backgrounding, audio track dies (readyState === 'ended') but AudioManager still held the dead stream, causing silent recordings.

**Steps**:
1. Start a conversation in **Talk** tab
2. Background the browser for 30+ seconds (or lock the phone)
3. Return to the app
4. Try to speak

**Expected**:
- System detects the dead track
- Automatically re-initializes the mic
- Recording works after recovery

**Regression files**: `src/lib/audioManager.ts` (startCapture track health check), `src/hooks/useWhisperSTT.ts` (re-init on failed startCapture)

---

## TC-012: AudioManager — Max Recording Safety Net

**Bug**: If silence detection fails for any reason, the mic could stay open indefinitely.

**Steps**:
1. Start recording in any voice input context
2. Continuously make noise (or put phone near a speaker) so silence is never detected

**Expected**:
- Recording auto-stops after 60 seconds maximum
- Audio is still sent for transcription

**Regression files**: `src/lib/audioManager.ts` (maxRecordingTimer: 60_000ms)
