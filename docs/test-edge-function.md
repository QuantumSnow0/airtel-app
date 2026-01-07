# Test Edge Function Directly

## Quick Test

Test if the Edge Function is working by calling it directly:

```bash
curl -X GET "https://YOUR_PROJECT.supabase.co/functions/v1/proxy-with-version-check/rest/v1/leads?select=count" \
  -H "x-app-version: 3" \
  -H "apikey: YOUR_ANON_KEY"
```

Replace:
- `YOUR_PROJECT` with your Supabase project ID
- `YOUR_ANON_KEY` with your anon key

**Expected:**
- If version 3 >= min version: Returns data
- If version too old: Returns 403 error

## Check Edge Function Logs

1. Go to Supabase Dashboard → Edge Functions
2. Click on `proxy-with-version-check`
3. Go to "Logs" tab
4. You should see logs like:
   - `📥 Edge Function called:`
   - `🔐 App version received:`
   - `📊 Min version required:`
   - `✅ Version check passed` or `❌ Version check failed`

## Common Issues

1. **Edge Function not deployed** - Redeploy it
2. **Missing environment variable** - Set `SUPABASE_SERVICE_ROLE_KEY`
3. **RLS still blocking** - Make sure you ran the blocking SQL
4. **Custom fetch not working** - Check app console logs










