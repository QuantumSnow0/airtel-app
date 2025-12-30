-- Temporary Test: Bypass Version Check to Verify Data Exists
-- Run this to test if data is accessible without version gating

-- Step 1: Create a temporary permissive policy that allows all access
-- This will help us verify if data exists and if the issue is with the version check
CREATE POLICY "temp_allow_all_for_testing" ON public.leads
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Step 2: Test query (should now work if data exists)
SELECT 
  'Test query result:' as info,
  COUNT(*) as total_leads
FROM public.leads;

-- Step 3: Show sample data
SELECT 
  id,
  customer_name,
  installation_town,
  created_at
FROM public.leads
LIMIT 10;

-- IMPORTANT: After testing, remove this temporary policy:
-- DROP POLICY "temp_allow_all_for_testing" ON public.leads;

