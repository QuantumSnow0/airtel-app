-- Fix RLS: Remove version gating from RLS (since Supabase doesn't support custom headers)
-- We'll implement version checking in the app code instead

-- Step 1: Drop the version gating policy (it doesn't work because headers aren't accessible)
DROP POLICY IF EXISTS "App version gating" ON public.leads;

-- Step 2: Create a simple policy that allows anon access
-- (We'll do version checking in the app code)
CREATE POLICY "Allow anon access" ON public.leads
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Step 3: Verify setup
SELECT 
  'Current policies:' as info,
  policyname,
  cmd as operation
FROM pg_policies 
WHERE tablename = 'leads' AND schemaname = 'public';

-- Step 4: Test that data is accessible
SELECT 
  'Data access test:' as test,
  COUNT(*) as total_leads
FROM public.leads;

-- Note: Version checking will now be done in the app code
-- The app will call check_app_version() function before making queries










