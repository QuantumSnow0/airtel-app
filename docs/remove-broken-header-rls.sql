-- Remove broken header-based RLS policy
-- Headers are NOT accessible in Supabase RLS - this approach is invalid

-- Step 1: Drop the broken header-based policy
DROP POLICY IF EXISTS "App version gating" ON public.leads;

-- Step 2: Temporarily allow access (until JWT-based solution is implemented)
-- WARNING: This removes version gating - use only temporarily
CREATE POLICY "Allow anon access temporarily" ON public.leads
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Step 3: Verify
SELECT 
  'Current policies:' as info,
  policyname,
  cmd as operation
FROM pg_policies 
WHERE tablename = 'leads' AND schemaname = 'public';

-- IMPORTANT: This is a temporary fix to restore data access.
-- You MUST implement JWT-based version gating for proper security.
-- See docs/app-version-gating-jwt-rls.sql for the correct approach.

