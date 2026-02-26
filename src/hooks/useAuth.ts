import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from '@supabase/supabase-js';
import { DEV_TEST_MODE, TEST_ACCOUNT } from '@/lib/constants';

// Global lock for auto-login — the promise itself acts as the lock (atomic)
const autoLoginLock = {
  promise: null as Promise<Session | null> | null,
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    let mounted = true;
    let authCheckComplete = false;

    // Set up auth state listener first (for both modes)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session || authCheckComplete) {
          setIsCheckingAuth(false);
        }
        // Trigger welcome email on sign-up or first sign-in
        if (session && (event === 'SIGNED_IN' || event === 'SIGNED_UP')) {
          supabase.functions.invoke('send-welcome-email').catch((err) => {
            console.error('Welcome email error:', err);
          });
        }
      }
    );

    // If dev test mode is enabled and credentials are provided, auto-login
    if (DEV_TEST_MODE && TEST_ACCOUNT.email && TEST_ACCOUNT.password) {
      const autoLogin = async () => {
        try {
          // If another instance is already handling login, wait for it
          if (autoLoginLock.promise) {
            const resultSession = await autoLoginLock.promise;
            authCheckComplete = true;
            if (mounted && resultSession) {
              setSession(resultSession);
              setUser(resultSession.user);
            }
            if (mounted) setIsCheckingAuth(false);
            return;
          }

          // Check if already logged in
          const { data: { session: existingSession } } = await supabase.auth.getSession();

          if (!mounted) return;

          if (existingSession) {
            setSession(existingSession);
            setUser(existingSession.user);
            setIsCheckingAuth(false);
            return;
          }

          // Not logged in, sign in with test credentials
          autoLoginLock.promise = (async (): Promise<Session | null> => {
            try {
              const { data, error } = await supabase.auth.signInWithPassword({
                email: TEST_ACCOUNT.email,
                password: TEST_ACCOUNT.password,
              });

              if (error) {
                console.error('DEV TEST MODE: Auto-login failed:', error);
                return null;
              }

              return data.session;
            } catch (err) {
              console.error('DEV TEST MODE: Auto-login error:', err);
              return null;
            }
          })();

          const resultSession = await autoLoginLock.promise;
          autoLoginLock.promise = null;
          authCheckComplete = true;

          if (!mounted) return;

          if (resultSession) {
            setSession(resultSession);
            setUser(resultSession.user);
          }
          setIsCheckingAuth(false);
        } catch (error) {
          console.error('DEV TEST MODE: Auto-login error:', error);
          autoLoginLock.promise = null;
          authCheckComplete = true;
          if (mounted) {
            setIsCheckingAuth(false);
          }
        }
      };

      autoLogin();

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    }

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);
        setIsCheckingAuth(false);
      } catch (error) {
        console.error('Auth check error:', error);
        if (mounted) {
          setIsCheckingAuth(false);
        }
      }
    };

    checkAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth';
  };

  return {
    user,
    session,
    isCheckingAuth,
    handleLogout
  };
};
