-- Identify and fix conflicting RLS policies
-- Run this to see what other policies exist and remove them

-- Step 1: Show ALL policies on leads table
SELECT 
  policyname,
  cmd as "Operation",
  roles as "Roles",
  qual as "USING clause",
  with_check as "WITH CHECK clause"
FROM pg_policies 
WHERE tablename = 'leads' AND schemaname = 'public'
ORDER BY policyname;

-- Step 2: Drop any policies that aren't "App version gating"
-- (This will keep only the version gating policy)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'leads' 
          AND schemaname = 'public'
          AND policyname != 'App version gating'
    ) 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.leads';
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
END $$;

-- Step 3: Verify only the version gating policy remains
SELECT 
  'Remaining policies:' as status,
  COUNT(*) as policy_count,
  string_agg(policyname, ', ') as policy_names
FROM pg_policies 
WHERE tablename = 'leads' AND schemaname = 'public';

-- Step 4: Ensure version gating policy exists (recreate if needed)
DROP POLICY IF EXISTS "App version gating" ON public.leads;

CREATE POLICY "App version gating" ON public.leads
  FOR ALL
  TO anon
  USING (
    COALESCE(
      NULLIF(current_setting('request.headers.x-app-version', true), '')::int,
      0
    ) >= (SELECT min_app_version FROM app_control WHERE id = 1)
  )
  WITH CHECK (
    COALESCE(
      NULLIF(current_setting('request.headers.x-app-version', true), '')::int,
      0
    ) >= (SELECT min_app_version FROM app_control WHERE id = 1)
  );

-- Step 5: Final verification
SELECT 
  'Final setup:' as check_type,
  COUNT(*) as "Total policies",
  string_agg(policyname, ', ') as "Policy names"
FROM pg_policies 
WHERE tablename = 'leads' AND schemaname = 'public';




