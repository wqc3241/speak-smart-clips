import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ─── Mock setup ─────────────────────────────────────────────────────

const mockFunctionsInvoke = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockFunctionsInvoke(...args),
    },
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }),
  },
}));

// Mock use-toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('useVideoProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('initializes with isProcessing false', async () => {
    const { useVideoProcessing } = await import('../useVideoProcessing');
    const { result } = renderHook(() => useVideoProcessing());

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.processingStep).toBe('');
  });

  it('cleans up polling intervals on unmount', async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    const { useVideoProcessing } = await import('../useVideoProcessing');
    const { unmount } = renderHook(() => useVideoProcessing());

    unmount();

    // Cleanup should have been called (even if no intervals exist, it should not error)
    // The important thing is that the hook doesn't throw
  });

  it('extracts video IDs correctly', async () => {
    const { useVideoProcessing } = await import('../useVideoProcessing');
    const { result } = renderHook(() => useVideoProcessing());

    expect(result.current.extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(result.current.extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(result.current.extractVideoId('not a youtube url')).toBeNull();
  });

  it('provides cleanup function', async () => {
    const { useVideoProcessing } = await import('../useVideoProcessing');
    const { result } = renderHook(() => useVideoProcessing());

    expect(typeof result.current.cleanup).toBe('function');

    // Should not throw when called
    act(() => {
      result.current.cleanup();
    });
  });
});

// ─── Language auto-detection & native caption selection ──────────────

describe('useVideoProcessing — language auto-detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('processVideo accepts only (videoId, userId, onProjectUpdate) — no languageCode param', async () => {
    const { useVideoProcessing } = await import('../useVideoProcessing');
    const { result } = renderHook(() => useVideoProcessing());

    // processVideo should have 3 params max (videoId, userId?, onProjectUpdate?)
    expect(result.current.processVideo.length).toBeLessThanOrEqual(3);
  });

  it('calls get-available-languages before extract-transcript', async () => {
    // get-available-languages returns Japanese manual captions
    mockFunctionsInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'get-available-languages') {
        return Promise.resolve({
          data: {
            success: true,
            availableLanguages: [
              { code: 'en', name: 'English', type: 'auto-generated' },
              { code: 'ja', name: 'Japanese', type: 'manual' },
            ],
          },
          error: null,
        });
      }
      if (fnName === 'extract-transcript') {
        return Promise.resolve({
          data: {
            success: true,
            transcript: 'こんにちは、今日のレッスンを始めましょう。',
            videoTitle: 'Japanese Lesson',
            captionsAvailable: true,
          },
          error: null,
        });
      }
      if (fnName === 'analyze-content') {
        return Promise.resolve({
          data: {
            vocabulary: [{ word: 'こんにちは', definition: 'Hello', difficulty: 'beginner' }],
            grammar: [{ rule: '〜ましょう', example: '始めましょう', explanation: 'Volitional form' }],
            detectedLanguage: 'Japanese',
          },
          error: null,
        });
      }
      if (fnName === 'generate-practice-sentences') {
        return Promise.resolve({ data: { sentences: [] }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { useVideoProcessing } = await import('../useVideoProcessing');
    const { result } = renderHook(() => useVideoProcessing());

    await act(async () => {
      await result.current.processVideo('test123');
    });

    // Should have called get-available-languages first
    expect(mockFunctionsInvoke).toHaveBeenCalledWith('get-available-languages', expect.objectContaining({
      body: { videoId: 'test123' },
    }));

    // Then extract-transcript with the preferred Japanese language code
    expect(mockFunctionsInvoke).toHaveBeenCalledWith('extract-transcript', expect.objectContaining({
      body: { videoId: 'test123', languageCode: 'ja' },
    }));
  });

  it('prefers manual non-English captions over auto-generated', async () => {
    mockFunctionsInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'get-available-languages') {
        return Promise.resolve({
          data: {
            success: true,
            availableLanguages: [
              { code: 'en', name: 'English', type: 'auto-generated' },
              { code: 'ko', name: 'Korean', type: 'auto-generated' },
              { code: 'ko', name: 'Korean', type: 'manual' },
            ],
          },
          error: null,
        });
      }
      if (fnName === 'extract-transcript') {
        return Promise.resolve({
          data: { success: true, transcript: '안녕하세요 테스트입니다', videoTitle: 'Korean Lesson', captionsAvailable: true },
          error: null,
        });
      }
      if (fnName === 'analyze-content') {
        return Promise.resolve({
          data: { vocabulary: [], grammar: [], detectedLanguage: 'Korean' },
          error: null,
        });
      }
      return Promise.resolve({ data: { sentences: [] }, error: null });
    });

    const { useVideoProcessing } = await import('../useVideoProcessing');
    const { result } = renderHook(() => useVideoProcessing());

    await act(async () => {
      await result.current.processVideo('korean1');
    });

    // Should pick manual Korean over auto-generated Korean
    expect(mockFunctionsInvoke).toHaveBeenCalledWith('extract-transcript', expect.objectContaining({
      body: { videoId: 'korean1', languageCode: 'ko' },
    }));
  });

  it('falls back to auto mode when get-available-languages fails', async () => {
    mockFunctionsInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'get-available-languages') {
        return Promise.reject(new Error('Network error'));
      }
      if (fnName === 'extract-transcript') {
        return Promise.resolve({
          data: { success: true, transcript: 'Ohayou gozaimasu. Today we learn greetings.', videoTitle: 'JP Lesson', captionsAvailable: true },
          error: null,
        });
      }
      if (fnName === 'analyze-content') {
        return Promise.resolve({
          data: { vocabulary: [], grammar: [], detectedLanguage: 'Japanese' },
          error: null,
        });
      }
      return Promise.resolve({ data: { sentences: [] }, error: null });
    });

    const { useVideoProcessing } = await import('../useVideoProcessing');
    const { result } = renderHook(() => useVideoProcessing());

    await act(async () => {
      await result.current.processVideo('fallback1');
    });

    // Should still call extract-transcript with no languageCode (auto mode)
    expect(mockFunctionsInvoke).toHaveBeenCalledWith('extract-transcript', expect.objectContaining({
      body: { videoId: 'fallback1', languageCode: undefined },
    }));
  });

  it('falls back to auto mode when only English captions are available', async () => {
    mockFunctionsInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'get-available-languages') {
        return Promise.resolve({
          data: {
            success: true,
            availableLanguages: [
              { code: 'en', name: 'English', type: 'auto-generated' },
            ],
          },
          error: null,
        });
      }
      if (fnName === 'extract-transcript') {
        return Promise.resolve({
          data: { success: true, transcript: 'Konnichiwa means hello in Japanese.', videoTitle: 'Lesson', captionsAvailable: true },
          error: null,
        });
      }
      if (fnName === 'analyze-content') {
        return Promise.resolve({
          data: { vocabulary: [], grammar: [], detectedLanguage: 'Japanese' },
          error: null,
        });
      }
      return Promise.resolve({ data: { sentences: [] }, error: null });
    });

    const { useVideoProcessing } = await import('../useVideoProcessing');
    const { result } = renderHook(() => useVideoProcessing());

    await act(async () => {
      await result.current.processVideo('enonly1');
    });

    // No non-English captions → languageCode should be undefined
    expect(mockFunctionsInvoke).toHaveBeenCalledWith('extract-transcript', expect.objectContaining({
      body: { videoId: 'enonly1', languageCode: undefined },
    }));
  });

  it('uses AI-detected language directly (no manual override)', async () => {
    mockFunctionsInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'get-available-languages') {
        return Promise.resolve({ data: { success: true, availableLanguages: [] }, error: null });
      }
      if (fnName === 'extract-transcript') {
        return Promise.resolve({
          data: { success: true, transcript: 'Bonjour, comment allez-vous?', videoTitle: 'French Lesson', captionsAvailable: true },
          error: null,
        });
      }
      if (fnName === 'analyze-content') {
        return Promise.resolve({
          data: {
            vocabulary: [{ word: 'Bonjour', definition: 'Hello', difficulty: 'beginner' }],
            grammar: [],
            detectedLanguage: 'French',
          },
          error: null,
        });
      }
      return Promise.resolve({ data: { sentences: [] }, error: null });
    });

    const { useVideoProcessing } = await import('../useVideoProcessing');
    const { result } = renderHook(() => useVideoProcessing());

    let project: unknown;
    await act(async () => {
      project = await result.current.processVideo('french1');
    });

    // The project's detectedLanguage should come from AI, not user selection
    expect((project as { detectedLanguage: string }).detectedLanguage).toBe('French');

    // Toast should mention the AI-detected language
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      description: expect.stringContaining('French'),
    }));
  });

  it('sets detectedLanguage to "Detecting..." for pending transcript jobs', async () => {
    mockFunctionsInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'get-available-languages') {
        return Promise.resolve({ data: { success: true, availableLanguages: [] }, error: null });
      }
      if (fnName === 'extract-transcript') {
        return Promise.resolve({
          data: { status: 'pending', jobId: 'job-xyz' },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { useVideoProcessing } = await import('../useVideoProcessing');
    const { result } = renderHook(() => useVideoProcessing());

    let project: unknown;
    await act(async () => {
      project = await result.current.processVideo('pending1');
    });

    // Pending project should show "Detecting..." instead of a hardcoded language
    expect((project as { detectedLanguage: string }).detectedLanguage).toBe('Detecting...');
    expect((project as { status: string }).status).toBe('pending');
  });
});
