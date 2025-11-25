# Google OAuth Configuration Checklist

## ✅ What You Need to Add in Google Cloud Console

Go to your Google Cloud Console OAuth client and add this **Authorized redirect URI**:

```
https://sthidehegwyiwoishltl.supabase.co/auth/v1/callback
```

### Steps

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your **Beton** project
3. Navigate to **APIs & Services** > **Credentials**
4. Click on your OAuth 2.0 Client ID (the one you created)
5. In the **Authorized redirect URIs** section, click **+ ADD URI**
6. Paste: `https://sthidehegwyiwoishltl.supabase.co/auth/v1/callback`
7. Click **SAVE**

## How It Works

1. User clicks "Continue with Google" on your login/signup page
2. User is redirected to Google's login page
3. After authentication, Google redirects to: `https://sthidehegwyiwoishltl.supabase.co/auth/v1/callback?code=...`
4. Supabase processes the code and creates a session
5. Supabase redirects back to your app at: `http://localhost:3001/auth/callback?code=...`
6. Your callback handler exchanges the code for a session
7. User is redirected to `/app/app` (the main application)

## Troubleshooting

If you see "redirect_uri_mismatch" error:

- The redirect URI you added in Google Cloud Console doesn't match
- Make sure you added the exact URL: `https://sthidehegwyiwoishltl.supabase.co/auth/v1/callback`

If nothing happens after selecting an account:

- Check browser console for errors
- Make sure the callback route exists at `/auth/callback`
- Verify Supabase credentials are correct in `.env.local`
