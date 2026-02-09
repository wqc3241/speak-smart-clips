import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from '@supabase/supabase-js';
import { DEV_TEST_MODE, TEST_ACCOUNT } from '@/lib/constants';

// Global lock for auto-login to prevent multiple concurrent attempts
const autoLoginLock = {
  inProgress: false,
  failed: false,
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
        // Only set checking to false once we have a session or auth check is complete
        if (session || authCheckComplete) {
          setIsCheckingAuth(false);
        }
      }
    );

    // If dev test mode is enabled, auto-login with test account
    if (DEV_TEST_MODE) {
      const autoLogin = async () => {
        try {
          // If auto-login already failed, don't retry - just finish checking
          if (autoLoginLock.failed) {
            console.log('🧪 DEV TEST MODE: Auto-login previously failed, skipping.');
            authCheckComplete = true;
            if (mounted) setIsCheckingAuth(false);
            return;
          }

          // First, check if we should be the one to do the login (synchronous check)
          if (autoLoginLock.inProgress && autoLoginLock.promise) {
            // Another hook instance is already handling login
            console.log('🧪 DEV TEST MODE: Waiting for auto-login from another instance...');
            const resultSession = await autoLoginLock.promise;
            authCheckComplete = true;
            if (mounted && resultSession) {
              setSession(resultSession);
              setUser(resultSession.user);
            }
            if (mounted) setIsCheckingAuth(false);
            return;
          }
          
          // Reset stale lock (from HMR) if promise is missing
          if (autoLoginLock.inProgress && !autoLoginLock.promise) {
            autoLoginLock.inProgress = false;
          }
          
          // Mark login as in progress immediately (before any async operations)
          autoLoginLock.inProgress = true;
          
          // Check if already logged in
          const { data: { session: existingSession } } = await supabase.auth.getSession();
          
          if (!mounted) return;
          
          if (existingSession) {
            // Already logged in, use existing session
            console.log('🧪 DEV TEST MODE: Using existing session');
            setSession(existingSession);
            setUser(existingSession.user);
            autoLoginLock.inProgress = false;
            setIsCheckingAuth(false);
            return;
          }
          
          // Not logged in, sign in with test credentials
          console.log('🧪 DEV TEST MODE: Signing in with test account...');
          
          autoLoginLock.promise = (async (): Promise<Session | null> => {
            const { data, error } = await supabase.auth.signInWithPassword({
              email: TEST_ACCOUNT.email,
              password: TEST_ACCOUNT.password,
            });
            
            if (error) {
              console.error('🧪 DEV TEST MODE: Auto-login failed:', error);
              autoLoginLock.inProgress = false;
              autoLoginLock.failed = true;
              return null;
            }
            
            console.log('🧪 DEV TEST MODE: Successfully logged in as', data.user?.email);
            autoLoginLock.inProgress = false;
            return data.session;
          })();
          
          const resultSession = await autoLoginLock.promise;
          authCheckComplete = true;
          
          if (!mounted) return;
          
          if (resultSession) {
            setSession(resultSession);
            setUser(resultSession.user);
          }
          setIsCheckingAuth(false);
        } catch (error) {
          console.error('🧪 DEV TEST MODE: Auto-login error:', error);
          autoLoginLock.inProgress = false;
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
        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session) {
          // Not logged in - redirect immediately
          // We'll handle redirection in the component or a protected route wrapper
          // but for now keeping consistent with original logic if needed, 
          // though usually hooks shouldn't side-effect redirect unless intended.
          // The original code redirected: window.location.href = '/auth';
        }
        
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
