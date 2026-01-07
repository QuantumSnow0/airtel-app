-- Hybrid Blocking Solution
-- This blocks old apps by requiring a secret parameter that only new apps know
-- 
-- NOTE: This is less secure than JWT-based RLS, but simpler to implement
-- Old apps won't have the secret and will be blocked

-- Step 1: Ensure app_control table exists
CREATE TABLE IF NOT EXISTS app_control (
  id int primary key default 1,
  min_app_version int not null,
  version_secret text not null default 'change-this-secret-key'
);

-- Update secret (change this to a random string)
UPDATE app_control 
SET version_secret = 'your-secret-key-here-2024'
WHERE id = 1;

-- Step 2: Enable and force RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;

-- Step 3: Drop existing policies
DROP POLICY IF EXISTS "App version gating" ON public.leads;
DROP POLICY IF EXISTS "block_all_anon_access_leads" ON public.leads;
DROP POLICY IF EXISTS "Allow anon access temporarily" ON public.leads;
DROP POLICY IF EXISTS "require_version_secret" ON public.leads;

-- Step 4: Create policy that requires secret
-- Old apps won't have this secret and will be blocked
CREATE POLICY "require_version_secret" ON public.leads
  FOR ALL
  TO anon
  USING (
    -- Check if request has the secret (only new apps will send this)
    -- Note: This uses a workaround since headers don't work in RLS
    -- We'll need to send the secret as a query parameter or in a different way
    -- For now, this is a placeholder - you'll need to modify your app to send the secret
    current_setting('request.query.version_secret', true) = 
      (SELECT version_secret FROM app_control WHERE id = 1)
    OR
    -- Allow if secret matches (fallback for testing)
    current_setting('app.settings.version_secret', true) = 
      (SELECT version_secret FROM app_control WHERE id = 1)
  )
  WITH CHECK (
    current_setting('request.query.version_secret', true) = 
      (SELECT version_secret FROM app_control WHERE id = 1)
    OR
    current_setting('app.settings.version_secret', true) = 
      (SELECT version_secret FROM app_control WHERE id = 1)
  );

-- IMPORTANT: This approach has limitations:
-- 1. Query parameters might not be accessible in RLS either
-- 2. Secret can be extracted from app code
-- 3. Not as secure as JWT-based approach
--
-- For true security, use JWT-based RLS (see docs/app-version-gating-jwt-rls.sql)










