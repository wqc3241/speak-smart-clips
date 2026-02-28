import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// Mock use-toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('useTextToSpeech', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock URL.createObjectURL and revokeObjectURL
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:test-url');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it('initializes with isPlaying false', async () => {
    const { useTextToSpeech } = await import('@/hooks/useTextToSpeech');
    const { result } = renderHook(() => useTextToSpeech());

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentText).toBeNull();
  });

  it('cleans up audio on unmount', async () => {
    const { useTextToSpeech } = await import('@/hooks/useTextToSpeech');
    const { unmount } = renderHook(() => useTextToSpeech());

    // Unmounting should not throw
    unmount();

    // URL.revokeObjectURL would be called if there were an active object URL
    // Since we didn't call speak(), nothing to revoke
  });

  it('returns speak function', async () => {
    const { useTextToSpeech } = await import('@/hooks/useTextToSpeech');
    const { result } = renderHook(() => useTextToSpeech());

    expect(typeof result.current.speak).toBe('function');
  });
});
