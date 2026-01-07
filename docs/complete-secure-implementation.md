# Complete Secure Version Gating Implementation

## The Challenge

Supabase RLS cannot read custom HTTP headers, so we need a different approach to block old apps at the database level.

## The Solution: Edge Function Proxy

**Architecture:**
```
Old App (no version check) → Direct Supabase → BLOCKED by RLS
New App → Edge Function (validates version) → Service Role → Supabase → ALLOWED
```

## Implementation Steps

### Step 1: Deploy Edge Function

1. Go to Supabase Dashboard → Edge Functions
2. Create function: `proxy-with-version-check`
3. Copy code from `supabase/functions/proxy-with-version-check/index.ts`
4. Set environment variable: `SUPABASE_SERVICE_ROLE_KEY` (from Settings → API)

### Step 2: Update RLS to Block Direct Access

Run this SQL in Supabase:

```sql
-- Block all direct anon access
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon access temporarily" ON public.leads;

-- Create policy that blocks all anon access
-- Only service role (via Edge Function) can access
CREATE POLICY "block_anon_direct_access" ON public.leads
  FOR ALL
  TO anon
  USING (false)  -- Block all direct anon access
  WITH CHECK (false);
```

### Step 3: Update App to Use Edge Function

**Current:** App calls Supabase directly
**New:** App calls Edge Function, which proxies to Supabase

This requires updating all Supabase calls. See next section for helper function.

### Step 4: Create Helper Function

Create `lib/supabase-proxy.ts` that wraps Supabase calls through the Edge Function.

## Alternative: Simpler Blocking (Recommended for Now)

Since rewriting all Supabase calls is complex, use this approach:

1. **Keep current app code** (direct Supabase calls)
2. **Add RLS that blocks if no special header**
3. **Edge Function adds header** when version is valid
4. **But headers don't work in RLS...**

## The Real Solution

The ONLY way to truly block old apps is:

1. **Edge Function validates version**
2. **Edge Function uses service role** (bypasses RLS)
3. **App calls Edge Function** instead of Supabase
4. **Edge Function proxies requests**

This requires updating the app architecture. Let me create a wrapper that makes this easier...










