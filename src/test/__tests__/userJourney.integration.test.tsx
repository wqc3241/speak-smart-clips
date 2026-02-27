/**
 * E2E Integration Test — Full User Journey
 *
 * Exercises the complete flow in a jsdom environment:
 *   1. Registration
 *   2. Onboarding popup walkthrough
 *   3. YouTube video search → project creation
 *   4. Learning units display
 *   5. Talk tab multi-round conversation
 *   6. Persistence across tab switch & simulated refresh
 *
 * All external services (Supabase auth/DB/functions, TTS, Speech Recognition)
 * are mocked. The conversation phase uses the text-input fallback path
 * (SpeechRecognition isSupported = false), which works identically on mobile
 * and desktop browsers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';

// ─── Mock data constants ─────────────────────────────────────────────

const MOCK_USER = {
  id: 'user-001',
  email: 'test@example.com',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: '2025-01-01T00:00:00Z',
};

const MOCK_SESSION = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: MOCK_USER,
};

const MOCK_SEARCH_RESULTS = [
  {
    videoId: 'vid-001',
    title: 'Japanese Tennis Lesson',
    thumbnail: 'https://img.youtube.com/vi/vid-001/mqdefault.jpg',
    channelTitle: 'LangChannel',
  },
  {
    videoId: 'vid-002',
    title: 'Tennis in Tokyo',
    thumbnail: 'https://img.youtube.com/vi/vid-002/mqdefault.jpg',
    channelTitle: 'TokyoSports',
  },
];

const MOCK_VOCABULARY = [
  { word: 'ラケット', definition: 'racket', meaning: 'tennis racket', difficulty: 'beginner' },
  { word: 'テニス', definition: 'tennis', meaning: 'the sport of tennis', difficulty: 'beginner' },
  { word: '試合', definition: 'match/game', meaning: 'competitive match', difficulty: 'intermediate' },
  { word: 'ストリング', definition: 'string', meaning: 'racket string', difficulty: 'intermediate' },
  { word: 'ナチュラル', definition: 'natural', meaning: 'natural gut string', difficulty: 'advanced' },
];

const MOCK_GRAMMAR = [
  { rule: '〜ています', example: '使っています', explanation: 'Ongoing state or habitual action' },
  { rule: '〜ことができます', example: 'お探しすることができます', explanation: 'Ability/possibility expression' },
  { rule: '〜てください', example: 'お声かけをしてください', explanation: 'Polite request form' },
];

const MOCK_PRACTICE_SENTENCES = [
  { text: 'ラケットを買いました', translation: 'I bought a racket', difficulty: 'beginner' as const, usedVocabulary: ['ラケット'], usedGrammar: [] },
];

const MOCK_DB_PROJECT = {
  id: 'proj-001',
  user_id: 'user-001',
  title: 'Japanese Tennis Lesson',
  youtube_url: 'https://www.youtube.com/watch?v=vid-001',
  script: 'テニスのレッスン...',
  vocabulary: MOCK_VOCABULARY,
  grammar: MOCK_GRAMMAR,
  practice_sentences: MOCK_PRACTICE_SENTENCES,
  detected_language: 'Japanese',
  vocabulary_count: 5,
  grammar_count: 3,
  status: 'completed',
  job_id: null,
  error_message: null,
  last_accessed: '2025-06-01T00:00:00Z',
  created_at: '2025-06-01T00:00:00Z',
  updated_at: '2025-06-01T00:00:00Z',
};

function makeQuestions(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `q-${i + 1}`,
    type: 'multiple_choice' as const,
    question: `Question ${i + 1}?`,
    correctAnswer: 'A',
    options: ['A', 'B', 'C', 'D'],
    difficulty: 'beginner' as const,
  }));
}

const MOCK_LEARNING_UNITS_DB = [
  {
    id: 'unit-001',
    user_id: 'user-001',
    project_id: 'proj-001',
    unit_number: 1,
    title: 'Basic Tennis Vocabulary',
    description: 'Learn essential tennis terms',
    difficulty: 'beginner',
    questions: makeQuestions(10),
    question_count: 10,
    is_completed: false,
    best_score: null,
    attempts: 0,
    stars: 0,
    last_attempted_at: null,
  },
  {
    id: 'unit-002',
    user_id: 'user-001',
    project_id: 'proj-001',
    unit_number: 2,
    title: 'Polite Match Phrases',
    description: 'Practice polite expressions',
    difficulty: 'intermediate',
    questions: makeQuestions(10),
    question_count: 10,
    is_completed: false,
    best_score: null,
    attempts: 0,
    stars: 0,
    last_attempted_at: null,
  },
];

const CHAT_REPLIES = [
  'こんにちは！テニスについて話しましょう。',
  'テニスは楽しいですね！ラケットは何を使っていますか？',
  'バボラは良いラケットですね。どのくらいテニスをしていますか？',
  '3年ですか！すごいですね。試合にも出ていますか？',
];

const MOCK_SUMMARY = {
  overallScore: 8,
  overallComment: 'Great conversation!',
  sentencesUsed: [
    { original: 'テニスが大好きです', corrected: 'テニスが大好きです', translation: 'I love tennis', isCorrect: true },
  ],
  vocabularyUsed: [
    { word: 'テニス', usedCorrectly: true, context: 'Used in greeting' },
  ],
  grammarPatterns: [
    { pattern: '〜ています', usedCorrectly: true, example: '使っています' },
  ],
  feedback: [
    { category: 'Pronunciation', message: 'Good natural phrasing', severity: 'positive' as const },
  ],
};

// ─── Module mocks (must be before component imports) ─────────────────

// UUID counter
let uuidCounter = 0;
vi.stubGlobal('crypto', {
  ...globalThis.crypto,
  randomUUID: () => `uuid-${String(++uuidCounter).padStart(4, '0')}`,
});

// matchMedia stub
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// scrollIntoView stub (jsdom doesn't support it)
Element.prototype.scrollIntoView = vi.fn();

// IntersectionObserver stub
vi.stubGlobal('IntersectionObserver', class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
});

// ResizeObserver stub
vi.stubGlobal('ResizeObserver', class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
});

// ─── Supabase mock ───────────────────────────────────────────────────

const mockSignUp = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockFunctionsInvoke = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signInWithOAuth: vi.fn().mockResolvedValue({}),
    },
    from: (...args: unknown[]) => mockFrom(...args),
    functions: {
      invoke: (...args: unknown[]) => mockFunctionsInvoke(...args),
    },
  },
}));

// ─── Constants mock ──────────────────────────────────────────────────

vi.mock('@/lib/constants', () => ({
  TEST_TRANSCRIPT: 'test transcript',
  TEST_VIDEO_TITLE: 'Test Video',
  TEST_VIDEO_URL: 'https://www.youtube.com/watch?v=test',
  AVATAR_URL: 'https://example.com/avatar.png',
  DEV_TEST_MODE: false,
  TEST_ACCOUNT: { email: '', password: '' },
}));

// ─── TTS mock ────────────────────────────────────────────────────────
// Must use real React useState so isPlaying changes trigger re-renders
// in useConversation (which depends on isPlaying for speaking→listening).
// vi.hoisted creates a ref accessible from the hoisted vi.mock factory.

const ttsMockRef = vi.hoisted(() => ({
  impl: null as (() => {
    speak: (...args: unknown[]) => Promise<void>;
    stop: () => void;
    prime: () => void;
    isPlaying: boolean;
    currentText: string | null;
  }) | null,
}));

vi.mock('@/hooks/useTextToSpeech', () => ({
  useTextToSpeech: () => ttsMockRef.impl!(),
}));

// ─── Speech recognition mock ────────────────────────────────────────

// IMPORTANT: Function refs must be stable (created outside the hook function).
// If they're new on every render, useConversation's cleanup effect for
// [stopListening] fires every render, setting mountedRef.current = false
// before the isPlaying transition effect runs.
vi.mock('@/hooks/useSpeechRecognition', () => {
  const startListening = vi.fn();
  const stopListening = vi.fn();
  const resetTranscript = vi.fn();
  return {
    useSpeechRecognition: () => ({
      isListening: false,
      isSupported: false,
      transcript: '',
      finalTranscript: '',
      startListening,
      stopListening,
      resetTranscript,
    }),
  };
});

// ─── Conversation storage mock ──────────────────────────────────────

vi.mock('@/lib/conversationStorage', () => ({
  saveSession: vi.fn(),
  loadSessions: vi.fn().mockReturnValue([]),
  getSessions: vi.fn().mockReturnValue([]),
  getSessionsByProject: vi.fn().mockReturnValue([]),
  deleteSession: vi.fn(),
  clearAllSessions: vi.fn(),
}));

// ─── Component imports (after mocks) ────────────────────────────────

import { Toaster } from '@/components/ui/toaster';
import Auth from '@/pages/Auth';
import Index from '@/pages/Index';

// ─── Set up TTS mock implementation (needs real React) ──────────────

ttsMockRef.impl = () => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  // speak: set isPlaying=true immediately, resolve right away, then
  // set isPlaying=false after a short delay (simulating audio ending).
  // This matches real behaviour: speak() returns after audio starts,
  // caller sets status='speaking', then audio finishes → isPlaying=false.
  const speakFn = React.useCallback(async () => {
    setIsPlaying(true);
    setTimeout(() => setIsPlaying(false), 50);
  }, []);
  const stopFn = React.useCallback(() => setIsPlaying(false), []);
  const primeFn = React.useCallback(() => {}, []);
  return { speak: speakFn, stop: stopFn, prime: primeFn, isPlaying, currentText: null };
};

// ─── Helpers ─────────────────────────────────────────────────────────

function createChainableFromMock(resolveValue: unknown) {
  const chain: Record<string, unknown> = {};
  const chainFn = () => chain;
  chain.select = vi.fn().mockImplementation(chainFn);
  chain.insert = vi.fn().mockImplementation(chainFn);
  chain.update = vi.fn().mockImplementation(chainFn);
  chain.delete = vi.fn().mockImplementation(chainFn);
  chain.upsert = vi.fn().mockImplementation(chainFn);
  chain.eq = vi.fn().mockImplementation(chainFn);
  chain.neq = vi.fn().mockImplementation(chainFn);
  chain.order = vi.fn().mockImplementation(chainFn);
  chain.limit = vi.fn().mockImplementation(chainFn);
  chain.single = vi.fn().mockResolvedValue(resolveValue);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolveValue);
  chain.then = vi.fn().mockImplementation((cb: (v: unknown) => unknown) => Promise.resolve(resolveValue).then(cb));
  // Make the chain itself thenable for `await supabase.from(...).select(...)...`
  Object.defineProperty(chain, 'then', {
    value: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(resolveValue).then(onFulfilled, onRejected),
    writable: true,
    configurable: true,
  });
  return chain;
}

function setupAuthenticatedUser() {
  mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION } });
  mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
  mockOnAuthStateChange.mockImplementation((callback: (event: string, session: unknown) => void) => {
    // Fire the callback synchronously so the hook picks up the session
    setTimeout(() => callback('SIGNED_IN', MOCK_SESSION), 0);
    return {
      data: {
        subscription: { unsubscribe: vi.fn() },
      },
    };
  });
}

function setupUnauthenticatedUser() {
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockGetUser.mockResolvedValue({ data: { user: null } });
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
}

function renderApp(route = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Index />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('User Journey Integration', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    localStorage.clear();
    uuidCounter = 0;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ─── Phase 1: Registration ──────────────────────────────────────

  describe('Phase 1: Registration', () => {
    beforeEach(() => {
      setupUnauthenticatedUser();
    });

    it('user can sign up with email and password', async () => {
      mockSignUp.mockResolvedValue({ data: { user: MOCK_USER, session: null }, error: null });

      renderApp('/auth');

      // Click the Sign Up tab
      const signUpTab = screen.getByRole('tab', { name: /sign up/i });
      await user.click(signUpTab);

      // Fill in the form
      const emailInput = document.getElementById('signup-email')!;
      const passwordInput = document.getElementById('signup-password')!;

      await user.type(emailInput, 'newuser@test.com');
      await user.type(passwordInput, 'SecurePass123');

      // Submit
      const submitBtn = screen.getByRole('button', { name: /create account/i });
      await user.click(submitBtn);

      // Assert signUp was called correctly
      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'newuser@test.com',
            password: 'SecurePass123',
          }),
        );
      });

      // Assert success toast
      await waitFor(() => {
        expect(screen.getByText(/check your email to confirm/i)).toBeInTheDocument();
      });
    });

    it('shows validation error for short password', async () => {
      renderApp('/auth');

      const signUpTab = screen.getByRole('tab', { name: /sign up/i });
      await user.click(signUpTab);

      const emailInput = document.getElementById('signup-email')!;
      const passwordInput = document.getElementById('signup-password')!;

      await user.type(emailInput, 'test@test.com');
      await user.type(passwordInput, '123'); // Too short

      const submitBtn = screen.getByRole('button', { name: /create account/i });
      await user.click(submitBtn);

      // Should NOT call signUp
      expect(mockSignUp).not.toHaveBeenCalled();

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
      });
    });
  });

  // ─── Phase 2: Onboarding ───────────────────────────────────────

  describe('Phase 2: Onboarding', () => {
    beforeEach(() => {
      setupAuthenticatedUser();
      // New user — no projects
      mockFrom.mockImplementation((table: string) => {
        if (table === 'projects') {
          return createChainableFromMock({ data: null, error: null, count: 0 });
        }
        if (table === 'learning_units') {
          return createChainableFromMock({ data: [], error: null });
        }
        return createChainableFromMock({ data: null, error: null });
      });
      mockFunctionsInvoke.mockResolvedValue({ data: { success: true }, error: null });
    });

    it('shows onboarding and user clicks through all 4 steps', async () => {
      renderApp('/');

      // Step 1
      await waitFor(() => {
        expect(screen.getByText('Welcome to BreakLingo!')).toBeInTheDocument();
      });
      expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();

      // Click Next → Step 2
      await user.click(screen.getByRole('button', { name: /next/i }));
      expect(screen.getByText('Your Lesson is Built')).toBeInTheDocument();
      expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();

      // Click Next → Step 3
      await user.click(screen.getByRole('button', { name: /next/i }));
      expect(screen.getByText('Learn & Practice')).toBeInTheDocument();
      expect(screen.getByText('Step 3 of 4')).toBeInTheDocument();

      // Click Next → Step 4
      await user.click(screen.getByRole('button', { name: /next/i }));
      expect(screen.getByText('Speak with AI')).toBeInTheDocument();
      expect(screen.getByText('Step 4 of 4')).toBeInTheDocument();

      // Click Get Started → dismisses
      await user.click(screen.getByRole('button', { name: /get started/i }));

      await waitFor(() => {
        expect(screen.queryByText('Welcome to BreakLingo!')).not.toBeInTheDocument();
      });

      // localStorage updated
      expect(localStorage.getItem('breaklingo-onboarding-complete')).toBe('true');
    });

    it('does not show onboarding if already completed', async () => {
      localStorage.setItem('breaklingo-onboarding-complete', 'true');
      renderApp('/');

      // Wait for auth and page to load
      await waitFor(() => {
        expect(screen.queryByText('Welcome to BreakLingo!')).not.toBeInTheDocument();
      });
    });

    it('close button dismisses onboarding', async () => {
      renderApp('/');

      await waitFor(() => {
        expect(screen.getByText('Welcome to BreakLingo!')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /close guide/i }));

      await waitFor(() => {
        expect(screen.queryByText('Welcome to BreakLingo!')).not.toBeInTheDocument();
      });
      expect(localStorage.getItem('breaklingo-onboarding-complete')).toBe('true');
    });
  });

  // ─── Phase 3: Video Search & Project Creation ──────────────────

  describe('Phase 3: Video search and project creation', () => {
    beforeEach(() => {
      setupAuthenticatedUser();
      localStorage.setItem('breaklingo-onboarding-complete', 'true');

      mockFunctionsInvoke.mockImplementation((fnName: string, opts?: { body: unknown }) => {
        switch (fnName) {
          case 'youtube-search':
            return Promise.resolve({
              data: { success: true, results: MOCK_SEARCH_RESULTS },
              error: null,
            });
          case 'extract-transcript':
            return Promise.resolve({
              data: {
                success: true,
                transcript: 'テニスのレッスン...',
                videoTitle: 'Japanese Tennis Lesson',
                captionsAvailable: true,
              },
              error: null,
            });
          case 'analyze-content':
            return Promise.resolve({
              data: {
                vocabulary: MOCK_VOCABULARY,
                grammar: MOCK_GRAMMAR,
                detectedLanguage: 'Japanese',
              },
              error: null,
            });
          case 'generate-practice-sentences':
            return Promise.resolve({
              data: { sentences: MOCK_PRACTICE_SENTENCES },
              error: null,
            });
          case 'generate-learning-units':
            return Promise.resolve({ data: { success: true }, error: null });
          case 'send-welcome-email':
            return Promise.resolve({ data: { success: true }, error: null });
          default:
            return Promise.resolve({ data: null, error: null });
        }
      });

      // DB mock — new user with no projects initially
      mockFrom.mockImplementation((table: string) => {
        if (table === 'projects') {
          const chain = createChainableFromMock({ data: null, error: null, count: 0 });
          // The insert chain should resolve on await
          (chain as Record<string, unknown>).insert = vi.fn().mockImplementation(() => {
            const insertChain = createChainableFromMock({ data: [MOCK_DB_PROJECT], error: null });
            return insertChain;
          });
          // For the triggerUnitGeneration lookup
          (chain as Record<string, unknown>).single = vi.fn().mockResolvedValue({
            data: { id: 'proj-001' },
            error: null,
          });
          return chain;
        }
        if (table === 'learning_units') {
          return createChainableFromMock({ data: [], error: null });
        }
        return createChainableFromMock({ data: null, error: null });
      });
    });

    it('searches for video, selects it, and triggers processing', async () => {
      renderApp('/');

      // Wait for the search input to appear (we're on the input tab)
      const searchInput = await screen.findByPlaceholderText('Search YouTube for videos...');

      // Type search query
      await user.type(searchInput, 'Japanese tennis lesson');

      // Click Search button
      const searchBtn = screen.getByRole('button', { name: /^search$/i });
      await user.click(searchBtn);

      // Wait for search results
      await waitFor(() => {
        expect(mockFunctionsInvoke).toHaveBeenCalledWith('youtube-search', expect.objectContaining({
          body: expect.objectContaining({ query: 'Japanese tennis lesson' }),
        }));
      });

      // Results should appear
      const videoTitle = await screen.findByText('Japanese Tennis Lesson');
      expect(videoTitle).toBeInTheDocument();

      // Click on the first video
      await user.click(videoTitle);

      // Language selector should appear
      await waitFor(() => {
        expect(screen.getByText('Select Language')).toBeInTheDocument();
      });

      // The Continue button should be disabled without a selection
      const continueBtn = screen.getByRole('button', { name: /continue/i });
      expect(continueBtn).toBeDisabled();
    });
  });

  // ─── Phase 4: Learning Units Display ───────────────────────────

  describe('Phase 4: Learning units display', () => {
    beforeEach(() => {
      setupAuthenticatedUser();
      localStorage.setItem('breaklingo-onboarding-complete', 'true');

      mockFunctionsInvoke.mockImplementation((fnName: string) => {
        if (fnName === 'send-welcome-email') {
          return Promise.resolve({ data: { success: true }, error: null });
        }
        return Promise.resolve({ data: { success: true }, error: null });
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'projects') {
          // User has 1 completed project → default tab = 'learn'
          const chain = createChainableFromMock({ data: [MOCK_DB_PROJECT], error: null, count: 1 });
          return chain;
        }
        if (table === 'learning_units') {
          const chain = createChainableFromMock({ data: MOCK_LEARNING_UNITS_DB, error: null });
          return chain;
        }
        return createChainableFromMock({ data: null, error: null });
      });
    });

    it('displays generated learning units on Learn tab', async () => {
      renderApp('/');

      // Learn tab should auto-activate since user has projects
      // Wait for learning units to appear
      await waitFor(() => {
        expect(screen.getByText('Learning Path')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Unit titles should be visible
      expect(screen.getByText('Basic Tennis Vocabulary')).toBeInTheDocument();
      expect(screen.getByText('Polite Match Phrases')).toBeInTheDocument();

      // Unit count badge
      expect(screen.getByText('2 units')).toBeInTheDocument();

      // First unit should have Start button (it's unlocked)
      const startButtons = screen.getAllByRole('button', { name: /start/i });
      expect(startButtons.length).toBeGreaterThanOrEqual(1);

      // Unit details — question count (at least one unit shows the count)
      const questionLabels = screen.getAllByText('10 questions');
      expect(questionLabels.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Phase 5: Talk Tab Conversation ────────────────────────────

  describe('Phase 5: Talk tab conversation', () => {
    let chatCallCount: number;

    beforeEach(() => {
      setupAuthenticatedUser();
      localStorage.setItem('breaklingo-onboarding-complete', 'true');
      chatCallCount = 0;

      mockFunctionsInvoke.mockImplementation((fnName: string) => {
        switch (fnName) {
          case 'conversation-chat': {
            const reply = CHAT_REPLIES[chatCallCount] || 'Default reply';
            chatCallCount++;
            return Promise.resolve({ data: { success: true, reply }, error: null });
          }
          case 'conversation-summary':
            return Promise.resolve({ data: { success: true, summary: MOCK_SUMMARY }, error: null });
          case 'send-welcome-email':
            return Promise.resolve({ data: { success: true }, error: null });
          default:
            return Promise.resolve({ data: { success: true }, error: null });
        }
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'projects') {
          const chain = createChainableFromMock({ data: [MOCK_DB_PROJECT], error: null, count: 1 });
          return chain;
        }
        if (table === 'learning_units') {
          return createChainableFromMock({ data: MOCK_LEARNING_UNITS_DB, error: null });
        }
        return createChainableFromMock({ data: null, error: null });
      });
    });

    it('user selects project and has 3-4 rounds of text conversation', async () => {
      renderApp('/');

      // Wait for page to load, then navigate to Talk tab
      await waitFor(() => {
        expect(screen.getByText('Learning Path')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Click the Talk tab
      const talkTab = screen.getByRole('tab', { name: /talk/i });
      await user.click(talkTab);

      // Wait for project selector to appear
      await waitFor(() => {
        expect(screen.getByText('Voice Conversation')).toBeInTheDocument();
      });

      // Click on the project
      const projectTitle = screen.getByText('Japanese Tennis Lesson');
      await user.click(projectTitle);

      // ConversationMode should render — since isSupported is false, show text-only mode
      await waitFor(() => {
        expect(screen.getByText(/speech recognition not supported/i)).toBeInTheDocument();
      });

      // Click "Start Text Conversation"
      const startBtn = screen.getByRole('button', { name: /start text conversation/i });
      await user.click(startBtn);

      // Wait for AI greeting (first chat call)
      await waitFor(() => {
        expect(screen.getByText(CHAT_REPLIES[0])).toBeInTheDocument();
      }, { timeout: 5000 });

      // Wait for the input to become enabled.
      // With TTS mocked (isPlaying always false), the useConversation effect
      // detects !isPlaying && status === 'speaking' and transitions to 'listening'.
      const messageInput = screen.getByPlaceholderText('Type a message...');
      await waitFor(() => {
        expect(messageInput).not.toBeDisabled();
      }, { timeout: 5000 });

      // Round 1: User sends a message
      await user.type(messageInput, 'テニスが大好きです{Enter}');

      // Wait for AI response (second chat call)
      await waitFor(() => {
        expect(screen.getByText(CHAT_REPLIES[1])).toBeInTheDocument();
      }, { timeout: 5000 });

      // Round 2 — wait for input to re-enable after AI speaks
      await waitFor(() => {
        expect(messageInput).not.toBeDisabled();
      }, { timeout: 3000 });
      await user.type(messageInput, 'バボラを使っています{Enter}');
      await waitFor(() => {
        expect(screen.getByText(CHAT_REPLIES[2])).toBeInTheDocument();
      }, { timeout: 5000 });

      // Round 3 — wait for input to re-enable
      await waitFor(() => {
        expect(messageInput).not.toBeDisabled();
      }, { timeout: 3000 });
      await user.type(messageInput, '3年ぐらいです{Enter}');
      await waitFor(() => {
        expect(screen.getByText(CHAT_REPLIES[3])).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify 4 conversation-chat calls total (1 greeting + 3 user messages)
      const chatCalls = mockFunctionsInvoke.mock.calls.filter(
        (call: unknown[]) => call[0] === 'conversation-chat',
      );
      expect(chatCalls).toHaveLength(4);

      // Stop the conversation
      const stopBtn = screen.getByRole('button', { name: /stop/i });
      await user.click(stopBtn);

      // Wait for summary to generate — either "Analyzing" spinner or final summary
      await waitFor(() => {
        const hasSummary = screen.queryByText('Session Summary');
        const hasAnalyzing = screen.queryByText(/analyzing your conversation/i);
        expect(hasSummary || hasAnalyzing).toBeTruthy();
      }, { timeout: 5000 });

      // If still analyzing, wait for the final summary
      if (screen.queryByText(/analyzing your conversation/i)) {
        await waitFor(() => {
          expect(screen.getByText('Session Summary')).toBeInTheDocument();
        }, { timeout: 10000 });
      }

      // Verify summary content
      expect(mockFunctionsInvoke).toHaveBeenCalledWith(
        'conversation-summary',
        expect.any(Object),
      );
    }, 30000);
  });

  // ─── Phase 6: Persistence ──────────────────────────────────────

  describe('Phase 6: Learning units persist across navigation', () => {
    beforeEach(() => {
      setupAuthenticatedUser();
      localStorage.setItem('breaklingo-onboarding-complete', 'true');

      mockFunctionsInvoke.mockImplementation((fnName: string) => {
        if (fnName === 'send-welcome-email') {
          return Promise.resolve({ data: { success: true }, error: null });
        }
        // generate-learning-units should NOT be called
        if (fnName === 'generate-learning-units') {
          return Promise.resolve({ data: { success: true }, error: null });
        }
        return Promise.resolve({ data: { success: true }, error: null });
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'projects') {
          return createChainableFromMock({ data: [MOCK_DB_PROJECT], error: null, count: 1 });
        }
        if (table === 'learning_units') {
          return createChainableFromMock({ data: MOCK_LEARNING_UNITS_DB, error: null });
        }
        return createChainableFromMock({ data: null, error: null });
      });
    });

    it('learning units persist when switching tabs back and forth', async () => {
      renderApp('/');

      // Wait for Learn tab with units
      await waitFor(() => {
        expect(screen.getByText('Learning Path')).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.getByText('Basic Tennis Vocabulary')).toBeInTheDocument();
      expect(screen.getByText('Polite Match Phrases')).toBeInTheDocument();

      // Switch to Search tab
      const searchTab = screen.getByRole('tab', { name: /search/i });
      await user.click(searchTab);

      // Verify we're on the search tab
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search YouTube for videos...')).toBeInTheDocument();
      });

      // Switch back to Learn tab
      const learnTab = screen.getByRole('tab', { name: /learn/i });
      await user.click(learnTab);

      // Units should still be there
      await waitFor(() => {
        expect(screen.getByText('Basic Tennis Vocabulary')).toBeInTheDocument();
        expect(screen.getByText('Polite Match Phrases')).toBeInTheDocument();
      });
    });

    it('learning units persist after unmount and remount (simulated refresh)', async () => {
      const { unmount } = renderApp('/');

      // Wait for units
      await waitFor(() => {
        expect(screen.getByText('Learning Path')).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.getByText('Basic Tennis Vocabulary')).toBeInTheDocument();

      // Track generate-learning-units calls before remount
      const generateCallsBefore = mockFunctionsInvoke.mock.calls.filter(
        (call: unknown[]) => call[0] === 'generate-learning-units',
      ).length;

      // Unmount (simulate leaving the page)
      unmount();

      // Remount (simulate refresh / returning)
      renderApp('/');

      // Units should appear again from DB
      await waitFor(() => {
        expect(screen.getByText('Learning Path')).toBeInTheDocument();
        expect(screen.getByText('Basic Tennis Vocabulary')).toBeInTheDocument();
        expect(screen.getByText('Polite Match Phrases')).toBeInTheDocument();
      }, { timeout: 5000 });

      // No new generate-learning-units calls
      const generateCallsAfter = mockFunctionsInvoke.mock.calls.filter(
        (call: unknown[]) => call[0] === 'generate-learning-units',
      ).length;
      expect(generateCallsAfter).toBe(generateCallsBefore);
    });

    it('existing learning units are never regenerated — zero generation calls across load, tab switches, and refreshes', async () => {
      // Render the app for an existing account that already has learning units
      const { unmount } = renderApp('/');

      // Wait for units to load from DB
      await waitFor(() => {
        expect(screen.getByText('Learning Path')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify exact unit content is displayed
      expect(screen.getByText('Basic Tennis Vocabulary')).toBeInTheDocument();
      expect(screen.getByText('Polite Match Phrases')).toBeInTheDocument();
      expect(screen.getByText('2 units')).toBeInTheDocument();

      // CRITICAL: zero generate-learning-units calls on initial load
      const generateCalls = () =>
        mockFunctionsInvoke.mock.calls.filter(
          (call: unknown[]) => call[0] === 'generate-learning-units',
        ).length;
      expect(generateCalls()).toBe(0);

      // ── Tab switch: Learn → Search → Talk → Learn ──
      await user.click(screen.getByRole('tab', { name: /search/i }));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search YouTube for videos...')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /talk/i }));
      await waitFor(() => {
        expect(screen.getByText('Voice Conversation')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /learn/i }));
      await waitFor(() => {
        expect(screen.getByText('Basic Tennis Vocabulary')).toBeInTheDocument();
        expect(screen.getByText('Polite Match Phrases')).toBeInTheDocument();
      });

      // Still zero generation calls after tab switches
      expect(generateCalls()).toBe(0);

      // ── First refresh (unmount + remount) ──
      unmount();
      const { unmount: unmount2 } = renderApp('/');

      await waitFor(() => {
        expect(screen.getByText('Learning Path')).toBeInTheDocument();
        expect(screen.getByText('Basic Tennis Vocabulary')).toBeInTheDocument();
        expect(screen.getByText('Polite Match Phrases')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Still zero generation calls after first refresh
      expect(generateCalls()).toBe(0);

      // ── Second refresh ──
      unmount2();
      renderApp('/');

      await waitFor(() => {
        expect(screen.getByText('Learning Path')).toBeInTheDocument();
        expect(screen.getByText('Basic Tennis Vocabulary')).toBeInTheDocument();
        expect(screen.getByText('Polite Match Phrases')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Still zero generation calls after second refresh
      expect(generateCalls()).toBe(0);

      // Verify unit content is still identical (not reordered, not duplicated)
      expect(screen.getByText('2 units')).toBeInTheDocument();
      expect(screen.getAllByText('10 questions').length).toBeGreaterThanOrEqual(1);
    });
  });
});
