-- Quick Test: Lower min version to 0 to test if policy logic works
-- This will help us determine if the issue is with header access or policy logic

-- Step 1: Temporarily set min version to 0 (allows all versions)
UPDATE app_control 
SET min_app_version = 0 
WHERE id = 1;

-- Step 2: Verify the change
SELECT 
  'Min version set to:' as info,
  min_app_version
FROM app_control 
WHERE id = 1;

-- Step 3: Test query (should work now if policy logic is correct)
-- Try this from your app - it should work if the policy logic is the issue
SELECT COUNT(*) FROM public.leads;

-- IMPORTANT: After testing, restore the min version:
-- UPDATE app_control SET min_app_version = 2 WHERE id = 1;




