<p align="center">
  <img src="https://storage.googleapis.com/gpt-engineer-file-uploads/Ra5nuHzDP7Yn8XkWFAjb44p8ID62/uploads/1770673090806-orange_fox.png" alt="BreakLingo Logo" width="120" />
</p>

<h1 align="center">BreakLingo</h1>

<p align="center">
  <strong>Learn language from Real Videos</strong>
</p>

<p align="center">
  <a href="https://breaklingo.com">breaklingo.com</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Supabase-Backend-3FCF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/OpenAI-Whisper_%26_TTS-412991?logo=openai&logoColor=white" alt="OpenAI" />
</p>

---

## What is BreakLingo?

BreakLingo is an AI-powered language learning platform that turns YouTube videos into interactive learning experiences. Paste any YouTube video, and BreakLingo will:

1. **Extract & analyze** the transcript — vocabulary, grammar, and practice sentences
2. **Generate quiz units** — 9 question types across beginner to advanced difficulty
3. **Practice conversation** — talk with an AI partner using voice, in the language you're studying

It works on desktop and mobile browsers, with full voice conversation support on iOS and Android.

---

## Features

| Feature | Description |
|---------|-------------|
| **Video Discovery** | Search YouTube or paste a URL to start learning |
| **AI Content Analysis** | Extracts vocabulary, grammar points, and practice sentences from video transcripts |
| **Learning Path** | 10–40 auto-generated quiz units with adaptive difficulty |
| **9 Question Types** | Multiple choice, fill-in-the-blank, word arrangement, listening, match pairs, read-after-me, and more |
| **Voice Conversation** | Talk with an AI partner in your target language using OpenAI Whisper (STT) and TTS |
| **Cross-Platform Voice** | Reliable speech input on all platforms including iOS, powered by a soft-pause AudioManager |
| **Project Management** | Save, favorite, and revisit your video projects |
| **Progress Tracking** | Star ratings, best scores, and completion status per unit |

---

## Architecture

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, Vite, React Router 6 |
| UI | shadcn/ui (Radix UI), Tailwind CSS |
| State | React hooks, React Query |
| Backend | Supabase (PostgreSQL, Edge Functions, Auth) |
| AI | Gemini 3 Flash (via Lovable Gateway), OpenAI TTS, OpenAI Whisper STT |
| APIs | YouTube Data API v3, Supadata (transcript extraction), Resend (email) |

### High-Level Flow

```
YouTube Video
    │
    ▼
Extract transcript (Supadata) → AI analysis (Gemini) → vocabulary, grammar, sentences
    │
    ▼
Generate 10–40 quiz units (9 question types, 3 difficulty tiers)
    │
    ▼
Voice Conversation (OpenAI Whisper STT ↔ Gemini Chat ↔ OpenAI TTS)
```

### Voice Conversation Architecture

The voice conversation system uses **OpenAI Whisper** for speech-to-text on all platforms, replacing the browser's native Web Speech API. Audio capture is managed by a singleton `AudioManager` that acquires the microphone once and uses **soft-pause** (`track.enabled` toggling) to avoid hardware re-acquisition delays on iOS.

```
User clicks "Start Conversation"
    │
    ▼
AudioManager.init() — acquires mic once via getUserMedia
    │
    ▼
User holds voice button → startCapture() (unmute track, start MediaRecorder)
    │
    ▼
User releases / silence detected → stopCapture() (mute track, return audio Blob)
    │
    ▼
Whisper STT (via Supabase Edge Function) → transcription text
    │
    ▼
AI reply (Gemini) → TTS audio (OpenAI) → playback
    │
    ▼
Mic stream stays alive — user can speak again immediately
    │
    ▼
On conversation end → AudioManager.destroy() releases hardware
```

### Edge Functions (15 Supabase Deno Functions)

| Function | Purpose |
|----------|---------|
| analyze-content | Extract vocabulary & grammar from transcript |
| generate-practice-sentences | Create practice sentences |
| generate-learning-units | Generate quiz units (9 question types) |
| conversation-chat | AI conversation partner |
| conversation-summary | Evaluate conversation and generate feedback |
| extract-transcript | Extract YouTube captions |
| poll-transcript-job | Poll async transcript jobs |
| generate-speech | Text-to-speech (OpenAI TTS) |
| transcribe-audio | Speech-to-text (OpenAI Whisper) |
| youtube-search | Search YouTube videos |
| get-available-languages | List available caption languages |
| send-welcome-email | Onboarding email |
| submit-feedback | Save user feedback |
| migrate-project-titles | Data migration utility |

### Directory Structure

```
src/
├── pages/                     # Auth, Index (dashboard), NotFound
├── components/
│   ├── auth/                  # Sign in/up, password reset
│   ├── dashboard/             # Header, InputTab, StudyTab
│   ├── features/
│   │   ├── conversation/      # Voice conversation UI
│   │   ├── learning/          # Learning path & quiz interface
│   │   ├── practice/          # Practice interface
│   │   ├── video/             # Video discovery & preview
│   │   ├── vocabulary/        # Vocabulary panel
│   │   └── ...                # Feedback, onboarding, project management
│   └── ui/                    # 70+ shadcn/ui primitives
├── hooks/                     # Core logic (auth, conversation, TTS, STT, video processing)
├── lib/
│   ├── audioManager.ts        # Singleton mic manager (soft-pause for iOS)
│   └── ...                    # Language utils, conversation storage, constants
├── types/                     # TypeScript type definitions
└── integrations/supabase/     # Supabase client & auto-generated types

supabase/
├── functions/                 # 15 Deno edge functions
└── migrations/                # PostgreSQL schema migrations
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- npm
- A [Supabase](https://supabase.com/) project

### Installation

```sh
# Clone the repository
git clone https://github.com/nicolebling/speak-smart-clips.git
cd speak-smart-clips

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase and API keys
```

### Environment Variables

#### Frontend (.env)

```
VITE_SUPABASE_URL=             # Your Supabase project URL
VITE_SUPABASE_PUBLISHABLE_KEY= # Your Supabase anon key
```

#### Backend (Supabase Edge Function secrets)

```
LOVABLE_API_KEY=               # Lovable AI Gateway key (for Gemini)
YOUTUBE_API_KEY=               # YouTube Data API v3 key
SUPADATA_API_KEY=              # Supadata transcript API key
OPENAI_API_KEY=                # OpenAI key (TTS + Whisper STT)
RESEND_API_KEY=                # Resend email API key
```

### Development

```sh
# Start the dev server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Preview production build
npm run preview
```

### Deploying Edge Functions

```sh
# Login to Supabase CLI
npx supabase login

# Link to your project
npx supabase link --project-ref <your-project-ref>

# Deploy all edge functions
npx supabase functions deploy
```

---

## Testing on Mobile (iOS)

For local development testing on iOS devices, use [ngrok](https://ngrok.com/) to create an HTTPS tunnel:

```sh
ngrok http 8080
```

Add the ngrok URL to your Supabase project's **Authentication > URL Configuration > Redirect URLs** to enable OAuth login from the tunnel.

---

## License

Private project.
