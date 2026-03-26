

## Plan: BreakLingo Landing Page + Build Error Fixes

### Summary
Transform the `/` route into a public marketing landing page for BreakLingo, move the authenticated dashboard to `/dashboard`, add a "Sign In" button in the top-right corner, and fix the two existing build errors.

### Architecture Changes

```text
BEFORE:
  /      → Dashboard (requires auth, redirects to /auth)
  /auth  → Sign in / Sign up

AFTER:
  /          → Public landing page (no auth required)
  /dashboard → Dashboard (requires auth, redirects to /auth)
  /auth      → Sign in / Sign up (redirects to /dashboard if logged in)
```

### New Landing Page Design (`src/pages/Landing.tsx`)

The page will use BreakLingo's brand colors (orange primary `#E95A0C`, warm accents, Roboto font) and the fox mascot from `AVATAR_URL`.

**Sections:**
1. **Sticky Header Nav** - Fox logo + "BreakLingo" on left, "Sign In" button (ghost/outline) on top-right linking to `/auth`. If user is already logged in, show "Go to Dashboard" instead.
2. **Hero Section** - Large heading "Learn Languages from Real Videos", subtitle describing the app, prominent CTA buttons: "Download on iOS" (App Store badge) + "Try on Web" (links to `/auth`). Fox mascot image on the right side. Warm gradient background (`from-orange-50 via-white to-amber-50`).
3. **Features Section** - 3-4 feature cards using the app's actual capabilities:
   - Search & learn from YouTube videos
   - AI-powered vocabulary & grammar extraction
   - Interactive quizzes (multiple choice, fill-in-blank, word arrange, etc.)
   - Practice conversation with AI
4. **How It Works** - 3-step visual flow: Find a Video → AI Analyzes Content → Learn & Practice
5. **iOS App Promotion** - Section highlighting the iOS app with the uploaded screenshot image (`user-uploads://orange_fox-2.png` used as reference), App Store download CTA
6. **Footer** - Simple footer with BreakLingo branding

### File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/pages/Landing.tsx` | Create | New public landing/marketing page |
| `src/App.tsx` | Edit | Add `/dashboard` route, change `/` to Landing |
| `src/pages/Index.tsx` | Edit | Remove auth redirect to `/auth`, redirect to `/dashboard` auth check stays but redirects properly |
| `src/pages/Auth.tsx` | Edit | Redirect to `/dashboard` instead of `/` on login |
| `src/hooks/useAuth.ts` | Edit | Fix `SIGNED_UP` type error (line 30) - remove the invalid comparison |
| `supabase/functions/generate-speech/index.ts` | Edit | Fix Uint8Array response error by wrapping in `new Blob()` |

### Build Error Fixes (included in this plan)

1. **`useAuth.ts` line 30**: `event === 'SIGNED_UP'` is not a valid auth event in the current Supabase types. Fix: remove `SIGNED_UP` from the condition, keep only `SIGNED_IN`.

2. **`generate-speech/index.ts` line 150**: `Uint8Array` not assignable to `BodyInit`. Fix: wrap as `new Response(combinedAudio.buffer, ...)` or `new Blob([combinedAudio])`.

### Technical Details

- Landing page checks auth state to show "Sign In" vs "Go to Dashboard" in the nav, but does NOT redirect -- it's always publicly accessible
- The dashboard route (`/dashboard`) keeps the existing `Index.tsx` logic with auth guard
- `handleLogout` in `useAuth.ts` will redirect to `/` (landing) instead of `/auth`
- All existing dashboard functionality remains untouched, just moved to `/dashboard`
- Uses existing shadcn/ui components (Button, Card) and Tailwind classes consistent with the design system

