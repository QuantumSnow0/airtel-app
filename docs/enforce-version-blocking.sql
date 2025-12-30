-- ============================================
-- ENFORCE VERSION BLOCKING - Complete Solution
-- ============================================
-- This script ensures old app versions are COMPLETELY blocked
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Ensure app_control table exists
CREATE TABLE IF NOT EXISTS app_control (
  id int PRIMARY KEY DEFAULT 1,
  min_app_version int NOT NULL DEFAULT 3
);

-- Insert or update minimum version
INSERT INTO app_control (id, min_app_version)
VALUES (1, 3)
ON CONFLICT (id)
DO UPDATE SET min_app_version = EXCLUDED.min_app_version;

-- Step 2: Enable RLS on leads table
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;

-- Step 3: Remove any existing policies that allow direct access
DROP POLICY IF EXISTS "Allow public read access" ON public.leads;
DROP POLICY IF EXISTS "Allow public reads" ON public.leads;
DROP POLICY IF EXISTS "Allow public inserts" ON public.leads;
DROP POLICY IF EXISTS "Allow public updates" ON public.leads;
DROP POLICY IF EXISTS "block_all_anon_access_leads" ON public.leads;
DROP POLICY IF EXISTS "App version gating" ON public.leads;
DROP POLICY IF EXISTS "jwt_app_version_gate" ON public.leads;

-- Step 4: Create policy to BLOCK ALL direct access for anon role
-- This forces all traffic through the Edge Function
CREATE POLICY "block_anon_direct_access" ON public.leads
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Step 5: Allow service_role to access (for Edge Function)
-- The Edge Function uses service_role key, so it can access data
-- This is safe because the Edge Function performs version checking

-- Note: service_role bypasses RLS by default, so no policy needed

-- Step 6: Verify the setup
-- After running this, test:
-- 1. Direct queries with anon key should return empty/error
-- 2. Queries through Edge Function with correct version should work
-- 3. Queries through Edge Function with old version should return 403

-- ============================================
-- IMPORTANT NOTES:
-- ============================================
-- 1. This blocks ALL direct access to leads table for anon role
-- 2. All traffic MUST go through the Edge Function (proxy-with-version-check)
-- 3. The Edge Function checks version and proxies requests using service_role
-- 4. Old apps that don't use the Edge Function will get no data
-- 5. Old apps that use the Edge Function will get 403 errors
-- ============================================




