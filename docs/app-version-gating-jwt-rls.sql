-- App Version Gating using JWT Claims (SUPPORTED APPROACH)
-- This is the ONLY reliable way to do version gating in Supabase RLS
-- 
-- REQUIREMENTS:
-- 1. App version must be injected into JWT via Edge Function or backend
-- 2. RLS reads version from auth.jwt() ->> 'app_version'
-- 3. Cannot use custom HTTP headers (not supported by PostgREST)

-- Step 1: Ensure app_control table exists
CREATE TABLE IF NOT EXISTS app_control (
  id int primary key default 1,
  min_app_version int not null
);

INSERT INTO app_control (id, min_app_version)
VALUES (1, 2)
ON CONFLICT (id)
DO UPDATE SET min_app_version = EXCLUDED.min_app_version;

-- Step 2: Enable and force RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;

-- Step 3: Drop any existing broken policies
DROP POLICY IF EXISTS "App version gating" ON public.leads;
DROP POLICY IF EXISTS "block_all_anon_access_leads" ON public.leads;
DROP POLICY IF EXISTS "Allow anon access" ON public.leads;

-- Step 4: Create JWT-based version gating policy
-- NOTE: This ONLY works if app_version is in the JWT claim
-- If using anon key without JWT customization, this will block all access
CREATE POLICY "jwt_app_version_gate" ON public.leads
  FOR ALL
  TO anon
  USING (
    COALESCE(
      (auth.jwt() ->> 'app_version')::int,
      0
    ) >= (SELECT min_app_version FROM app_control WHERE id = 1)
  )
  WITH CHECK (
    COALESCE(
      (auth.jwt() ->> 'app_version')::int,
      0
    ) >= (SELECT min_app_version FROM app_control WHERE id = 1)
  );

-- Step 5: Verify setup
SELECT 
  'RLS Policy Status' as check_type,
  COUNT(*) as policy_count,
  string_agg(policyname, ', ') as policies
FROM pg_policies 
WHERE tablename = 'leads' AND schemaname = 'public';

-- IMPORTANT NOTES:
-- 1. This policy will BLOCK all access if app_version is not in JWT
-- 2. You MUST create an Edge Function to inject app_version into JWT
-- 3. See docs/create-edge-function-for-jwt.md for implementation
-- 4. If you continue using anon key without JWT, use the "soft enforcement" approach




