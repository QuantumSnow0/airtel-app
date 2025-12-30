-- ⚠️ THIS APPROACH IS INVALID - DO NOT USE ⚠️
-- 
-- Supabase/PostgREST does NOT expose custom HTTP headers to RLS policies.
-- The current_setting('request.headers.x-app-version') approach does NOT work.
-- 
-- This file is kept for reference only. Use the JWT-based approach instead.
--
-- CORRECT APPROACHES:
-- 1. JWT-based RLS: See docs/app-version-gating-jwt-rls.sql
-- 2. Frontend-only: See docs/app-version-gating-alternative.sql
-- 3. Architecture options: See docs/version-gating-architecture-options.md
--
-- To restore app functionality immediately, run:
-- docs/remove-broken-header-rls.sql

-- ============================================
-- INVALID CODE BELOW (for reference only)
-- ============================================

-- App Version Gating using Row Level Security
-- ❌ THIS DOES NOT WORK - Headers are not accessible in RLS

-- Step 1: Create app_control table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS app_control (
  id int primary key default 1,
  min_app_version int not null
);

-- Step 2: Insert or update the minimum app version
INSERT INTO app_control (id, min_app_version)
VALUES (1, 2)
ON CONFLICT (id)
DO UPDATE SET min_app_version = EXCLUDED.min_app_version;

-- Step 3: Enable and force Row Level Security on leads table
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;

-- Step 4: Drop existing policies if they exist
DROP POLICY IF EXISTS "App version check for SELECT" ON public.leads;
DROP POLICY IF EXISTS "App version check for INSERT" ON public.leads;
DROP POLICY IF EXISTS "App version check for UPDATE" ON public.leads;
DROP POLICY IF EXISTS "App version check for DELETE" ON public.leads;
DROP POLICY IF EXISTS "App version gating" ON public.leads;

-- Step 5: ❌ THIS POLICY DOES NOT WORK - Headers not accessible
-- CREATE POLICY "App version gating" ON public.leads
--   FOR ALL
--   TO anon
--   USING (
--     -- ❌ This will fail: current_setting('request.headers.x-app-version') is not available
--     COALESCE(
--       NULLIF(current_setting('request.headers.x-app-version', true), '')::int,
--       0
--     ) >= (SELECT min_app_version FROM app_control WHERE id = 1)
--   )
--   WITH CHECK (
--     COALESCE(
--       NULLIF(current_setting('request.headers.x-app-version', true), '')::int,
--       0
--     ) >= (SELECT min_app_version FROM app_control WHERE id = 1)
--   );
