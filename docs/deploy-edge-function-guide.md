# Deploy Edge Function Guide

## Method 1: Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard
   - Select your project

2. **Navigate to Edge Functions:**
   - Left sidebar → Edge Functions
   - Or: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/functions

3. **Create/Edit Function:**
   - Click "Create a new function" (if doesn't exist)
   - Or click on `proxy-with-version-check` to edit
   - Name: `proxy-with-version-check`

4. **Paste the code:**
   - Copy entire contents of `supabase/functions/proxy-with-version-check/index.ts`
   - Paste into the editor
   - Click "Deploy"

5. **Set Environment Variable:**
   - Go to Edge Functions → Settings (gear icon)
   - Add environment variable:
     - Name: `SUPABASE_SERVICE_ROLE_KEY`
     - Value: (Get from Settings → API → service_role key)
   - Save

## Method 2: Supabase CLI

1. **Login:**
   ```bash
   npx supabase login
   ```
   (Opens browser to authenticate)

2. **Link project (if needed):**
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```
   (Get project ref from Supabase Dashboard URL)

3. **Deploy:**
   ```bash
   npx supabase functions deploy proxy-with-version-check
   ```

4. **Set environment variable:**
   ```bash
   npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

## Verify Deployment

After deploying, test the function:

```bash
curl https://YOUR_PROJECT.supabase.co/functions/v1/proxy-with-version-check \
  -H "x-app-version: 3" \
  -H "apikey: YOUR_ANON_KEY"
```

Should return: `{"status":"ok","message":"Edge Function is running",...}`

## Check Logs

1. Go to Supabase Dashboard → Edge Functions
2. Click on `proxy-with-version-check`
3. Click "Logs" tab
4. You should see logs when the function is called




