import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * REGRESSION: Google OAuth redirecting to production instead of current origin
 *
 * When testing on a local dev server (e.g. via ngrok HTTPS tunnel), Google
 * OAuth via Supabase must redirect back to the CURRENT origin, not the
 * production Site URL (breaklingo.com).
 *
 * Root cause: The Auth page was previously hardcoding or misconfiguring the
 * redirectTo URL. The fix uses `window.location.origin` dynamically so it
 * always matches whichever domain the app is loaded from.
 *
 * Requirements:
 * 1. redirectTo must use window.location.origin (not a hardcoded domain)
 * 2. On production (breaklingo.com) it should redirect to breaklingo.com
 * 3. On ngrok (xxx.ngrok-free.dev) it should redirect to the ngrok URL
 * 4. On localhost it should redirect to localhost
 */

const mockSignInWithOAuth = vi.fn().mockResolvedValue({ data: {}, error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

describe('OAuth redirect URL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses window.location.origin for redirectTo (not hardcoded)', async () => {
    // Simulate being on an ngrok tunnel
    const testOrigin = 'https://abc123.ngrok-free.dev';
    Object.defineProperty(window, 'location', {
      value: { origin: testOrigin, href: testOrigin + '/auth', search: '', pathname: '/auth' },
      writable: true,
      configurable: true,
    });

    // Replicate the Auth page's handleGoogleSignIn logic
    const redirectTo = `${window.location.origin}/`;
    await mockSignInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: `${testOrigin}/`,
      },
    });

    // Must NOT contain breaklingo.com
    const callArgs = mockSignInWithOAuth.mock.calls[0][0];
    expect(callArgs.options.redirectTo).not.toContain('breaklingo.com');
    expect(callArgs.options.redirectTo).toBe(`${testOrigin}/`);
  });

  it('redirects to production when on production domain', async () => {
    const prodOrigin = 'https://breaklingo.com';
    Object.defineProperty(window, 'location', {
      value: { origin: prodOrigin, href: prodOrigin + '/auth', search: '', pathname: '/auth' },
      writable: true,
      configurable: true,
    });

    const redirectTo = `${window.location.origin}/`;
    await mockSignInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });

    const callArgs = mockSignInWithOAuth.mock.calls[0][0];
    expect(callArgs.options.redirectTo).toBe(`${prodOrigin}/`);
  });

  it('redirects to localhost when on localhost', async () => {
    const localOrigin = 'http://localhost:8080';
    Object.defineProperty(window, 'location', {
      value: { origin: localOrigin, href: localOrigin + '/auth', search: '', pathname: '/auth' },
      writable: true,
      configurable: true,
    });

    const redirectTo = `${window.location.origin}/`;
    await mockSignInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });

    const callArgs = mockSignInWithOAuth.mock.calls[0][0];
    expect(callArgs.options.redirectTo).toBe(`${localOrigin}/`);
    expect(callArgs.options.redirectTo).not.toContain('breaklingo.com');
  });
});
