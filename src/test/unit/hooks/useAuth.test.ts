import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Mock supabase before importing the hook
const mockUnsubscribe = vi.fn();
const mockOnAuthStateChange = vi.fn().mockReturnValue({
  data: { subscription: { unsubscribe: mockUnsubscribe } },
});
const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });
const mockSignInWithPassword = vi.fn().mockResolvedValue({
  data: { session: null, user: null },
  error: null,
});
const mockSignOut = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: mockOnAuthStateChange,
      getSession: mockGetSession,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
    },
  },
}));

// Mock constants — default: DEV_TEST_MODE off
vi.mock('@/lib/constants', () => ({
  DEV_TEST_MODE: false,
  TEST_ACCOUNT: { email: '', password: '' },
}));

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: null } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('checks session on mount', async () => {
    const { useAuth } = await import('@/hooks/useAuth');
    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isCheckingAuth).toBe(false);
    });

    expect(mockGetSession).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });

  it('subscribes to auth changes and unsubscribes on unmount', async () => {
    const { useAuth } = await import('@/hooks/useAuth');
    const { unmount } = renderHook(() => useAuth());

    expect(mockOnAuthStateChange).toHaveBeenCalled();

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('sets user and session when session exists', async () => {
    const mockSession = {
      user: { id: '123', email: 'test@example.com' },
      access_token: 'token',
    };
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });

    const { useAuth } = await import('@/hooks/useAuth');
    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isCheckingAuth).toBe(false);
    });

    expect(result.current.session).toBe(mockSession);
    expect(result.current.user).toBe(mockSession.user);
  });

  it('does not auto-login when DEV_TEST_MODE is false', async () => {
    const { useAuth } = await import('@/hooks/useAuth');
    renderHook(() => useAuth());

    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalled();
    });

    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });
});
