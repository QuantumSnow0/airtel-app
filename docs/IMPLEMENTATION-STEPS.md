# Secure Version Gating - Implementation Steps

## Goal
Block old apps from accessing data at the database level.

## Solution: Edge Function + Service Role

**How it works:**
- Old apps call Supabase directly → BLOCKED by RLS
- New apps call Edge Function → Validates version → Uses service role → ALLOWED

## Step 1: Deploy Edge Function

1. Go to Supabase Dashboard → Edge Functions
2. Click "Create a new function"
3. Name: `proxy-with-version-check`
4. Copy code from: `supabase/functions/proxy-with-version-check/index.ts`
5. Click "Deploy"

**Set Environment Variable:**
- Go to Edge Functions → Settings
- Add: `SUPABASE_SERVICE_ROLE_KEY` = (get from Settings → API → service_role key)

## Step 2: Block Direct Access with RLS

Run this SQL in Supabase SQL Editor:

```sql
-- Block all direct anon access to leads table
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Allow anon access temporarily" ON public.leads;
DROP POLICY IF EXISTS "block_all_anon_access_leads" ON public.leads;

-- Block all anon access (only service role via Edge Function can access)
CREATE POLICY "block_anon_direct_access" ON public.leads
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);
```

**Result:** All direct Supabase calls from app will be blocked.

## Step 3: Test Edge Function

Test the Edge Function works:

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/proxy-with-version-check/rest/v1/leads?select=count \
  -H "x-app-version: 3" \
  -H "apikey: YOUR_ANON_KEY"
```

Should return data if version >= min_version.

## Step 4: Update App (Simplified Approach)

Since rewriting all Supabase calls is complex, we'll create a wrapper that intercepts Supabase calls.

**Option A: Update Supabase Client** (Recommended)
- Modify `lib/supabase.ts` to route through Edge Function
- See next file for implementation

**Option B: Gradual Migration**
- Keep current code working
- Gradually migrate queries to use Edge Function
- Old queries still work (but will be blocked by RLS)
- New queries use Edge Function

## Current Status

✅ Edge Function code ready
✅ RLS blocking policy ready  
⏳ Need to update app to use Edge Function

## Next: Update Supabase Client

See `lib/supabase-proxy-wrapper.ts` for a wrapper that makes this easier.




