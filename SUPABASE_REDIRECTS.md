# Supabase Redirect URL Configuration

To ensure Google OAuth works correctly locally, you must add your local development URLs to the **Redirect URLs** allow list in Supabase.

## Steps

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard/project/sthidehegwyiwoishltl/auth/url-configuration).
2. Navigate to **Authentication** > **URL Configuration**.
3. Scroll down to **Redirect URLs**.
4. Click **Add URL**.
5. Add the following URLs:
   - `http://localhost:3000/**`
   - `http://localhost:3001/**`
   - `http://localhost:3002/**`
   - `https://sthidehegwyiwoishltl.supabase.co/auth/v1/callback` (This should already be there or is the default)

## Why is this needed?

Supabase's Auth server needs to know that it is safe to redirect the user back to `localhost` after they sign in with Google. If these URLs are not in the allow list, Supabase might block the redirect, or the browser might not receive the session correctly.

## Verification

After adding these URLs:

1. Restart your local server (just to be safe).
2. Try signing in with Google again.
