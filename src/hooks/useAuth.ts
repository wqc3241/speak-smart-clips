import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from '@supabase/supabase-js';
import { DEV_TEST_MODE, TEST_ACCOUNT } from '@/lib/constants';

// Singleton to prevent multiple auto-login attempts across all hook instances
const authState = {
  autoLoginAttempted: false,
  autoLoginPromise: null as Promise<void> | null,
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    // Set up auth state listener first (for both modes)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session) {
          setIsCheckingAuth(false);
        }
      }
    );

    // If dev test mode is enabled, auto-login with test account
    if (DEV_TEST_MODE) {
      const autoLogin = async () => {
        try {
          // Check if already logged in
          const { data: { session: existingSession } } = await supabase.auth.getSession();
          
          if (!mounted) return;
          
          if (existingSession) {
            // Already logged in, use existing session
            console.log('🧪 DEV TEST MODE: Using existing session');
            setSession(existingSession);
            setUser(existingSession.user);
            setIsCheckingAuth(false);
            return;
          }
          
          // If auto-login was already attempted, just wait and check session
          if (authState.autoLoginAttempted) {
            console.log('🧪 DEV TEST MODE: Waiting for existing auto-login...');
            if (authState.autoLoginPromise) {
              await authState.autoLoginPromise;
            }
            // After waiting, check session again
            const { data: { session: newSession } } = await supabase.auth.getSession();
            if (mounted && newSession) {
              setSession(newSession);
              setUser(newSession.user);
            }
            setIsCheckingAuth(false);
            return;
          }
          
          // Not logged in, sign in with test credentials
          console.log('🧪 DEV TEST MODE: Signing in with test account...');
          authState.autoLoginAttempted = true;
          
          authState.autoLoginPromise = (async () => {
            const { data, error } = await supabase.auth.signInWithPassword({
              email: TEST_ACCOUNT.email,
              password: TEST_ACCOUNT.password,
            });
            
            if (error) {
              console.error('🧪 DEV TEST MODE: Auto-login failed:', error);
              return;
            }
            
            console.log('🧪 DEV TEST MODE: Successfully logged in as', data.user?.email);
          })();
          
          await authState.autoLoginPromise;
          
          // Get the session after login
          const { data: { session: newSession } } = await supabase.auth.getSession();
          
          if (!mounted) return;
          
          if (newSession) {
            setSession(newSession);
            setUser(newSession.user);
          }
          setIsCheckingAuth(false);
        } catch (error) {
          console.error('🧪 DEV TEST MODE: Auto-login error:', error);
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
