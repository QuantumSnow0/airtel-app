-- Fix RLS Setup for Version Gating
-- Run this to ensure everything is configured correctly

-- Step 1: Ensure RLS is enabled and forced
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies to start fresh
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'leads' AND schemaname = 'public') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.leads';
    END LOOP;
END $$;

-- Step 3: Ensure app_control table exists with correct data
CREATE TABLE IF NOT EXISTS app_control (
  id int primary key default 1,
  min_app_version int not null
);

INSERT INTO app_control (id, min_app_version)
VALUES (1, 2)
ON CONFLICT (id)
DO UPDATE SET min_app_version = EXCLUDED.min_app_version;

-- Step 4: Create the version gating policy
CREATE POLICY "App version gating" ON public.leads
  FOR ALL
  TO anon
  USING (
    -- Check that x-app-version header exists and meets minimum requirement
    -- If header is missing (NULL), block access (fail closed)
    COALESCE(
      NULLIF(current_setting('request.headers.x-app-version', true), '')::int,
      0
    ) >= (SELECT min_app_version FROM app_control WHERE id = 1)
  )
  WITH CHECK (
    -- Same check for INSERT/UPDATE operations
    COALESCE(
      NULLIF(current_setting('request.headers.x-app-version', true), '')::int,
      0
    ) >= (SELECT min_app_version FROM app_control WHERE id = 1)
  );

-- Step 5: Verify setup
SELECT 
  'RLS Status' as check_type,
  CASE WHEN (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'leads' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
    THEN '✅ RLS FORCED'
    ELSE '❌ RLS NOT FORCED'
  END as status
UNION ALL
SELECT 
  'Policy Count',
  COUNT(*)::text || ' policy(ies) found'
FROM pg_policies 
WHERE tablename = 'leads' AND schemaname = 'public'
UNION ALL
SELECT 
  'Min Version',
  min_app_version::text || ' (app must be >= this)'
FROM app_control 
WHERE id = 1;










