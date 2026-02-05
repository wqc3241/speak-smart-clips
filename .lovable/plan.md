

## Add Developer Testing Mode (Skip Login)

### Overview
Add a testing mode that allows you to bypass authentication during development. This will create a mock user session so you can test all features without logging in.

### Safety Measures
- Only works in development environment (preview URLs)
- Uses a recognizable "test user" to avoid confusion
- Easy to toggle on/off

---

## Implementation

### Step 1: Add Test Mode Flag to Constants

**File:** `src/lib/constants.ts`

Add test mode configuration and mock user data:

```typescript
// Development testing mode - set to true to skip login
export const DEV_TEST_MODE = true;

// Mock user for testing (simulates a logged-in user)
export const TEST_USER = {
  id: 'test-user-dev-mode',
  email: 'dev-tester@test.local',
  user_metadata: {},
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
};
```

### Step 2: Update useAuth Hook to Support Test Mode

**File:** `src/hooks/useAuth.ts`

Modify the hook to bypass Supabase auth when in test mode:

```typescript
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

    // ... existing auth logic
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

  // ... rest of hook
};
```

### Step 3: Update Auth Page to Auto-Redirect in Test Mode

**File:** `src/pages/Auth.tsx`

Add early redirect when test mode is enabled:

```typescript
import { DEV_TEST_MODE } from '@/lib/constants';

const Auth = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // In dev test mode, redirect straight to main app
    if (DEV_TEST_MODE) {
      navigate('/');
      return;
    }
    // ... existing auth checks
  }, [navigate]);

  // ... rest of component
};
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/constants.ts` | Add `DEV_TEST_MODE` flag and `TEST_USER` mock object |
| `src/hooks/useAuth.ts` | Bypass Supabase auth when test mode is on |
| `src/pages/Auth.tsx` | Auto-redirect to main app in test mode |

---

## Usage

**To enable test mode:**  
Set `DEV_TEST_MODE = true` in `src/lib/constants.ts`

**To disable test mode:**  
Set `DEV_TEST_MODE = false` to restore normal authentication

---

## Important Notes

1. **Database operations will fail** when using the test user since it's not a real Supabase user. Project saving to database won't work, but you can still test UI, video processing, and AI features.

2. **To test with database:** You'll need to log in normally. The test mode is best for UI/feature testing.

3. **Remember to disable** before publishing to production by setting `DEV_TEST_MODE = false`.

