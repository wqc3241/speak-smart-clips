

## Auto-Login with Test Account When DEV_TEST_MODE is Enabled

### Overview
Change the test mode logic so that when `DEV_TEST_MODE` is `true`, the app automatically signs in with the test account (`qichaotomwang+1@gmail.com`) using Supabase authentication. This ensures you get a real authenticated session with a valid UUID, allowing all database queries to work correctly.

### Changes

---

**1. Update `src/lib/constants.ts`**

Add test account credentials:

```typescript
// Development testing mode - set to true to auto-login with test account
export const DEV_TEST_MODE = true;

// Test account credentials for auto-login
export const TEST_ACCOUNT = {
  email: 'qichaotomwang+1@gmail.com',
  password: '******', // You'll need to provide the password
};

// Remove or keep TEST_USER as fallback (optional)
```

---

**2. Update `src/hooks/useAuth.ts`**

Change the test mode logic to perform actual Supabase sign-in:

```typescript
useEffect(() => {
  if (DEV_TEST_MODE) {
    console.log('🧪 DEV TEST MODE: Auto-logging in with test account');
    
    const autoLogin = async () => {
      // Check if already logged in
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      
      if (existingSession) {
        // Already logged in, use existing session
        setSession(existingSession);
        setUser(existingSession.user);
        setIsCheckingAuth(false);
        return;
      }
      
      // Not logged in, sign in with test credentials
      const { data, error } = await supabase.auth.signInWithPassword({
        email: TEST_ACCOUNT.email,
        password: TEST_ACCOUNT.password,
      });
      
      if (error) {
        console.error('Auto-login failed:', error);
        setIsCheckingAuth(false);
        return;
      }
      
      setSession(data.session);
      setUser(data.user);
      setIsCheckingAuth(false);
    };
    
    autoLogin();
    return;
  }
  
  // ... rest of normal auth logic
}, []);
```

---

**3. Update `src/pages/Auth.tsx`**

Ensure the auth page also auto-redirects when test mode is enabled (already does this, but will work better with real session).

---

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/constants.ts` | Add `TEST_ACCOUNT` with email and password |
| `src/hooks/useAuth.ts` | Change test mode to perform real Supabase sign-in |

### Security Note

The test password will be stored in the code. This is acceptable for development/testing purposes, but make sure:
- This is a test account only, not used for production
- Don't commit sensitive passwords to public repositories

### Benefits

- Real authenticated session with valid UUID
- All database queries work correctly (projects, profiles, etc.)
- Learning path will load your actual project data
- Full feature testing with real data

