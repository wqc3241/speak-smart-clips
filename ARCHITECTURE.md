# BreakLingo Architecture

## Overview

BreakLingo is a language learning platform that transforms YouTube videos into interactive learning experiences. Users extract transcripts, analyze vocabulary and grammar with AI, generate quiz units, and practice via AI-powered conversation.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, Vite, React Router 6 |
| UI | shadcn/ui (Radix UI), Tailwind CSS |
| State | React hooks, React Query |
| Backend | Supabase (PostgreSQL, Edge Functions, Auth) |
| AI | Lovable AI Gateway (Gemini 3 Flash), OpenAI TTS, OpenAI Whisper STT |
| APIs | YouTube Data API v3, Supadata (transcript extraction), Resend (email) |

---

## Directory Structure

```
src/
├── pages/
│   ├── Index.tsx              # Main dashboard with tab-based interface
│   ├── Auth.tsx               # Sign in / sign up / password reset
│   └── NotFound.tsx           # 404 page
│
├── components/
│   ├── auth/                  # SignInForm, SignUpForm, ForgotPasswordForm, ResetPasswordForm
│   ├── dashboard/             # Header, InputTab, StudyTab
│   ├── features/
│   │   ├── conversation/      # ConversationMode, ConversationInterface, ConversationHistory
│   │   ├── learning/          # LearningPath, QuizInterface
│   │   │   └── questions/     # 8 question-type components
│   │   ├── practice/          # PracticeInterface
│   │   ├── project/           # ProjectManager
│   │   ├── video/             # VideoDiscovery, VideoCard, VideoPreview, ScriptDisplay
│   │   ├── vocabulary/        # VocabularyPanel
│   │   ├── feedback/          # FeedbackDialog
│   │   └── onboarding/        # OnboardingGuide
│   └── ui/                    # shadcn/ui primitives (70+ components)
│
├── hooks/
│   ├── useAuth.ts             # Authentication state, auto-login in dev
│   ├── useProject.ts          # Current project, auto-save to Supabase
│   ├── useVideoProcessing.ts  # Video extraction & AI processing pipeline
│   ├── useLearningUnits.ts    # Fetch/update learning units from DB
│   ├── useConversation.ts     # AI conversation state, STT/TTS integration
│   ├── useWhisperSTT.ts       # OpenAI Whisper STT via AudioManager + edge function
│   ├── useTextToSpeech.ts     # OpenAI TTS via edge function
│   ├── useBrowserTTS.ts       # Browser native SpeechSynthesis
│   ├── useSpeechRecognition.ts# Web Speech API wrapper (legacy, unused in conversation)
│   ├── useYouTubeSearch.ts    # YouTube search via edge function
│   └── use-mobile.tsx         # Mobile breakpoint detection
│
├── types/
│   ├── project.ts             # AppProject, VocabularyItem, GrammarItem, PracticeSentence
│   ├── quiz.ts                # QuizQuestion, LearningUnit, QuestionType
│   ├── conversation.ts        # ConversationMessage, ConversationSession, ConversationSummary
│   └── youtube.ts             # YouTubeSearchResult, CuratedVideo
│
├── lib/
│   ├── audioManager.ts        # Singleton mic manager (getUserMedia soft-pause for iOS)
│   ├── constants.ts           # Test data, dev mode config
│   ├── languageUtils.ts       # Language ↔ BCP-47 mapping, stop phrases
│   ├── conversationStorage.ts # LocalStorage for conversation sessions
│   ├── recommendedVideos.ts   # Curated video library
│   ├── typeGuards.ts          # Runtime type validation
│   └── validation.ts          # Zod schemas for auth forms
│
└── integrations/supabase/
    ├── client.ts              # Supabase client init
    └── types.ts               # Auto-generated DB types

supabase/
├── config.toml                # Function registration
├── functions/                 # 15 Deno edge functions
└── migrations/                # PostgreSQL schema migrations
```

---

## Database Schema

### projects
Main table storing user learning projects from YouTube videos.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → auth.users | |
| youtube_url | TEXT UNIQUE | Source video URL |
| title | TEXT | Video/project title |
| script | TEXT | Extracted transcript |
| vocabulary | JSONB | Array of VocabularyItem |
| grammar | JSONB | Array of GrammarItem |
| practice_sentences | JSONB | Array of PracticeSentence |
| detected_language | TEXT | AI-detected language |
| status | TEXT | pending / completed / failed |
| job_id | TEXT | Async transcript job ID |
| is_favorite | BOOLEAN | |
| vocabulary_count | INTEGER GENERATED | jsonb_array_length(vocabulary) |
| grammar_count | INTEGER GENERATED | jsonb_array_length(grammar) |
| created_at, updated_at, last_accessed | TIMESTAMPTZ | |

### learning_units
AI-generated quiz units per project.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| project_id | UUID FK → projects | CASCADE delete |
| user_id | UUID FK → auth.users | CASCADE delete |
| unit_number | INTEGER | Unique per (project, user) |
| title | TEXT | Unit title |
| description | TEXT | |
| difficulty | TEXT | beginner / intermediate / advanced |
| questions | JSONB | Array of QuizQuestion |
| question_count | INTEGER GENERATED | jsonb_array_length(questions) |
| is_completed | BOOLEAN | Score ≥ 60% |
| best_score | INTEGER | Highest score achieved |
| attempts | INTEGER | Total attempts |
| stars | INTEGER | 0-3 star rating |
| last_attempted_at | TIMESTAMPTZ | |

### user_feedback
| Column | Type |
|--------|------|
| id | UUID PK |
| user_id | UUID FK |
| user_email | TEXT |
| category | TEXT (default 'general') |
| message | TEXT |
| created_at | TIMESTAMPTZ |

### user_profiles
| Column | Type |
|--------|------|
| id | UUID PK FK → auth.users |
| welcome_email_sent | BOOLEAN |
| first_login_at | TIMESTAMPTZ |

### profiles
| Column | Type |
|--------|------|
| id | UUID PK FK → auth.users |
| email, full_name, avatar_url | TEXT |

### user_roles
| Column | Type |
|--------|------|
| id | UUID PK |
| user_id | UUID FK |
| role | ENUM (admin, moderator, user) |

**All tables have RLS enabled** — users can only access their own rows.

---

## Edge Functions

### AI Processing

| Function | Purpose | AI Model |
|----------|---------|----------|
| analyze-content | Extract vocabulary & grammar from transcript | Gemini 3 Flash (via Lovable Gateway) |
| generate-practice-sentences | Create practice sentences from extracted content | Gemini 3 Flash |
| generate-learning-units | Generate 10-40 quiz units with 9 question types | Gemini 3 Flash |
| conversation-chat | AI conversation partner in target language | Gemini 3 Flash |
| conversation-summary | Evaluate conversation, generate feedback | Gemini 3 Flash |

All AI functions use **structured output** via `tool_choice` (function calling) for reliable JSON responses.

### External API Integrations

| Function | Purpose | External API |
|----------|---------|-------------|
| extract-transcript | Extract YouTube captions | Supadata API |
| poll-transcript-job | Poll async transcript status | Supadata API |
| generate-speech | Text-to-speech audio | OpenAI gpt-4o-mini-tts |
| transcribe-audio | Speech-to-text transcription | OpenAI Whisper |
| youtube-search | Search YouTube videos | YouTube Data API v3 |
| get-available-languages | List caption languages | YouTube Data API v3 |
| send-welcome-email | Onboarding email | Resend API |

### Database Operations

| Function | Purpose |
|----------|---------|
| submit-feedback | Save user feedback |
| migrate-project-titles | Data migration utility (verify_jwt=false) |

---

## Data Flow Diagrams

### Video Processing Pipeline

```
User selects YouTube video
    │
    ▼
extract-transcript (Supadata API)
    │
    ├─ Immediate: transcript returned
    │       │
    │       ▼
    │   analyze-content (Gemini 3 Flash)
    │       │
    │       ▼  vocabulary[], grammar[], detectedLanguage
    │   generate-practice-sentences (Gemini 3 Flash)
    │       │
    │       ▼  practiceSentences[]
    │   Save project to DB
    │       │
    │       ▼
    │   generate-learning-units (Gemini 3 Flash)  ← fire-and-forget
    │       │
    │       ▼  10-40 learning units with questions[]
    │   Save units to learning_units table
    │
    └─ Async (AI generation): jobId returned
            │
            ▼
        poll-transcript-job (60s intervals)
            │
            ▼  On completion: same pipeline as above
```

### Learning Unit Generation

```
Project Data (vocabulary, grammar, sentences, script)
    │
    ▼
Calculate unit count: 10 + vocab/5 + grammar/3 + scriptChars/1000 (cap 40)
    │
    ▼
Batch generation (5 units per AI call, 2 batches in parallel)
    │
    ├─ System prompt: 9 question types, 8-12 questions per unit
    ├─ Difficulty distribution: first ⅓ beginner, middle ⅓ intermediate, last ⅓ advanced
    ├─ Rotate vocab/grammar coverage across batches
    └─ Structured output via tool_choice
    │
    ▼
Delete existing units (idempotent) → Bulk insert new units
```

### Voice Conversation Loop

```
User clicks "Start Conversation"
    │
    ▼
AudioManager.init() — acquires mic once via getUserMedia (single allocation)
    │
    ▼
User holds voice button → AudioManager.startCapture()
    │                        (unmutes track via track.enabled = true,
    │                         starts MediaRecorder, enables silence detection)
    ▼
User releases / silence detected → AudioManager.stopCapture()
    │                                (mutes track via track.enabled = false,
    │                                 returns audio Blob)
    ▼
useWhisperSTT → transcribe-audio edge function → OpenAI Whisper API
    │
    ▼  transcription text (finalTranscript)
processUserInput → conversation-chat (Gemini)
    │
    ▼  AI reply text
useTextToSpeech → generate-speech (OpenAI TTS)
    │
    ▼  Audio blob → play via <audio> element
On audio end → user can press voice button again (mic stream still alive)
    │
    ▼  (loop continues — mic is never released mid-conversation)

On stop: conversation-summary → feedback + localStorage save
         AudioManager.destroy() — releases mic hardware (track.stop())
```

**Key design choice:** The mic stream is acquired once and kept alive for the entire
conversation session using "soft-pause" (`track.enabled` toggling) instead of
`track.stop()`/`getUserMedia()` cycles. This avoids the ~40s iOS WebKit hardware lock
that occurs when the media server re-acquires audio input after TTS playback.

### Authentication Flow

```
User visits /
    │
    ▼
useAuth checks Supabase session
    │
    ├─ No session → redirect to /auth
    │       │
    │       ▼
    │   SignInForm / SignUpForm
    │       │
    │       ▼  On success → redirect to /
    │
    └─ Session exists → load Index
            │
            ▼
        Check project count
            │
            ├─ Has projects → default to Learn tab
            └─ No projects → default to Search tab + OnboardingGuide
```

---

## Key Hooks

### useVideoProcessing
Orchestrates the entire video processing pipeline. Handles transcript extraction, AI analysis, practice sentence generation, and async job polling. Returns `processVideo()`, `regenerateAnalysis()`, and processing state.

### useConversation
Manages AI conversation state. Integrates Whisper STT (input) and OpenAI TTS (output). Auto-pauses STT while TTS is playing to prevent echo. Uses `useWhisperSTT` (backed by `AudioManager` + OpenAI Whisper) as the universal STT provider on all platforms. Handles conversation start, stop, summary generation, and session storage.

### useLearningUnits
CRUD operations for learning units. Fetches from DB, updates progress (best score, stars, completion), triggers regeneration via edge function. Module-level caching for performance.

### useAuth
Manages authentication state with Supabase Auth. Supports dev auto-login via environment variables. Listens for auth state changes and provides user object + logout handler.

### useProject
Manages current project state. Auto-saves to Supabase on project changes with insert/update detection (checks for existing youtube_url). Returns `currentProject`, `setCurrentProject`, `autoSaveProject`.

---

## Question Types (9 Types)

| Type | Component | User Interaction |
|------|-----------|-----------------|
| multiple_choice | MultipleChoiceQ | Select 1 of 4 options |
| tell_meaning | MultipleChoiceQ | Select meaning of a word (same component) |
| translation | TranslationQ | Select correct translation |
| fill_blank | FillBlankQ | Select word to fill the blank |
| read_after_me | ReadAfterMeQ | Speak text aloud, fuzzy match ≥70% |
| multiple_select | MultipleSelectQ | Select 2-3 correct from 4-6 options |
| word_arrange | WordArrangeQ | Tap words to arrange in order |
| listening | ListeningQ | Listen to TTS, select what was said |
| match_pairs | MatchPairsQ | Match 4-5 word↔meaning pairs |

---

## Environment Variables

### Frontend (.env)
```
VITE_SUPABASE_URL             # Supabase project URL
VITE_SUPABASE_PUBLISHABLE_KEY # Supabase anon key
VITE_DEV_TEST_MODE            # Enable dev auto-login (optional)
VITE_TEST_EMAIL               # Dev test account email (optional)
VITE_TEST_PASSWORD             # Dev test account password (optional)
```

### Backend (Supabase Edge Functions)
```
SUPABASE_URL                  # Auto-provided
SUPABASE_ANON_KEY             # Auto-provided
SUPABASE_SERVICE_ROLE_KEY     # Auto-provided
LOVABLE_API_KEY               # Lovable AI Gateway key
YOUTUBE_API_KEY               # YouTube Data API v3 key
SUPADATA_API_KEY              # Supadata transcript API key
OPENAI_API_KEY                # OpenAI API key (for TTS and Whisper STT)
RESEND_API_KEY                # Resend email API key
```
