import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      }),
    },
  },
}));

// Mock AudioManager
const mockInit = vi.fn().mockResolvedValue(true);
const mockStartCapture = vi.fn().mockReturnValue(true);
const mockStopCapture = vi.fn().mockResolvedValue(new Blob(['audio'], { type: 'audio/webm' }));
const mockDestroy = vi.fn();
const mockGetState = vi.fn().mockReturnValue('idle');

vi.mock('@/lib/audioManager', () => ({
  AudioManager: {
    getInstance: () => ({
      init: mockInit,
      startCapture: mockStartCapture,
      stopCapture: mockStopCapture,
      destroy: mockDestroy,
      getState: mockGetState,
    }),
  },
}));

// Mock fetch for Whisper API calls
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock import.meta.env
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');

describe('useWhisperSTT', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetState.mockReturnValue('idle');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with correct default state', async () => {
    const { useWhisperSTT } = await import('../useWhisperSTT');
    const { result } = renderHook(() => useWhisperSTT());

    expect(result.current.isListening).toBe(false);
    expect(result.current.transcript).toBe('');
    expect(result.current.finalTranscript).toBe('');
  });

  it('initMic calls AudioManager.init()', async () => {
    const { useWhisperSTT } = await import('../useWhisperSTT');
    const { result } = renderHook(() => useWhisperSTT());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.initMic();
    });

    expect(mockInit).toHaveBeenCalledOnce();
    expect(ok).toBe(true);
  });

  it('destroyMic calls AudioManager.destroy()', async () => {
    const { useWhisperSTT } = await import('../useWhisperSTT');
    const { result } = renderHook(() => useWhisperSTT());

    act(() => {
      result.current.destroyMic();
    });

    expect(mockDestroy).toHaveBeenCalledOnce();
  });

  it('startListening inits mic if idle and starts capture', async () => {
    mockGetState.mockReturnValue('idle');
    const { useWhisperSTT } = await import('../useWhisperSTT');
    const { result } = renderHook(() => useWhisperSTT());

    await act(async () => {
      await result.current.startListening('mic-button');
    });

    expect(mockInit).toHaveBeenCalled();
    expect(mockStartCapture).toHaveBeenCalled();
    expect(result.current.isListening).toBe(true);
  });

  it('startListening skips init if already ready', async () => {
    mockGetState.mockReturnValue('ready');
    const { useWhisperSTT } = await import('../useWhisperSTT');
    const { result } = renderHook(() => useWhisperSTT());

    await act(async () => {
      await result.current.startListening('mic-button');
    });

    expect(mockInit).not.toHaveBeenCalled();
    expect(mockStartCapture).toHaveBeenCalled();
    expect(result.current.isListening).toBe(true);
  });

  /**
   * REGRESSION: iOS 40s mic freeze
   *
   * The old SpeechRecognition-based STT would freeze for ~40 seconds on iOS
   * after TTS playback due to a WebKit audio pipeline bug. This test verifies
   * that the Whisper-based STT uses AudioManager (getUserMedia with soft-pause)
   * which completely bypasses SpeechRecognition and avoids the freeze.
   *
   * The key invariants:
   * 1. AudioManager.init() is called ONCE (not per recording)
   * 2. startCapture/stopCapture cycle without re-acquiring the mic
   * 3. No SpeechRecognition API is used at all
   */
  it('does NOT use SpeechRecognition API (iOS 40s freeze regression)', async () => {
    const { useWhisperSTT } = await import('../useWhisperSTT');
    const { result } = renderHook(() => useWhisperSTT());

    // Init mic once
    await act(async () => {
      await result.current.initMic();
    });

    // Simulate multiple recording cycles (like user speaking multiple times)
    for (let i = 0; i < 3; i++) {
      mockGetState.mockReturnValue('ready');
      await act(async () => {
        await result.current.startListening('mic-button');
      });
      expect(mockStartCapture).toHaveBeenCalled();

      mockGetState.mockReturnValue('recording');
      act(() => {
        result.current.stopListening('finalTranscript');
      });
      expect(mockStopCapture).toHaveBeenCalled();

      vi.clearAllMocks();
    }

    // AudioManager.init should have been called only once (the explicit initMic call)
    // Subsequent startListening calls should NOT re-init (mic stays warm)
    expect(mockInit).not.toHaveBeenCalled();

    // SpeechRecognition should never have been instantiated
    expect((window as any).SpeechRecognition).toBeUndefined();
    expect((window as any).webkitSpeechRecognition).toBeUndefined();
  });

  it('stopListening sends audio to Whisper and returns transcript', async () => {
    mockGetState.mockReturnValue('recording');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, text: 'Hello world' }),
    });

    const { useWhisperSTT } = await import('../useWhisperSTT');
    const { result } = renderHook(() => useWhisperSTT());

    // Set up a large enough blob (>1000 bytes)
    mockStopCapture.mockResolvedValueOnce(
      new Blob([new ArrayBuffer(2000)], { type: 'audio/webm' })
    );

    act(() => {
      result.current.stopListening('silence');
    });

    // Wait for async transcription
    await vi.waitFor(() => {
      expect(result.current.finalTranscript).toBe('Hello world');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/transcribe-audio'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('skips transcription for very short audio', async () => {
    mockGetState.mockReturnValue('recording');
    // Blob smaller than 1000 bytes
    mockStopCapture.mockResolvedValueOnce(new Blob(['hi'], { type: 'audio/webm' }));

    const { useWhisperSTT } = await import('../useWhisperSTT');
    const { result } = renderHook(() => useWhisperSTT());

    act(() => {
      result.current.stopListening('manual');
    });

    // Should not call fetch
    await vi.waitFor(() => {
      expect(result.current.isListening).toBe(false);
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('resetTranscript clears both transcript and finalTranscript', async () => {
    const { useWhisperSTT } = await import('../useWhisperSTT');
    const { result } = renderHook(() => useWhisperSTT());

    act(() => {
      result.current.resetTranscript();
    });

    expect(result.current.transcript).toBe('');
    expect(result.current.finalTranscript).toBe('');
  });
});
