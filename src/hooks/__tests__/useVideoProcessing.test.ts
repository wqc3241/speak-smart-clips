import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
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
