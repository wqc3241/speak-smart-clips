import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from '@supabase/supabase-js';
import { DEV_TEST_MODE, TEST_USER } from '@/lib/constants';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // If dev test mode is enabled, skip real auth
    if (DEV_TEST_MODE) {
      console.log('🧪 DEV TEST MODE: Skipping authentication');
      setUser(TEST_USER as unknown as User);
      setSession({ user: TEST_USER } as unknown as Session);
      setIsCheckingAuth(false);
      return;
    }

    let mounted = true;

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

    // Set up auth state listener for future changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    checkAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    if (DEV_TEST_MODE) {
      // In test mode, just refresh to reset
      window.location.reload();
      return;
    }
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
