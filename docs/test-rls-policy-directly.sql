-- Test RLS Policy Directly
-- Run this in Supabase SQL Editor to verify the policy is working

-- Step 1: Check current min version
SELECT 
  'Current min_app_version:' as info,
  min_app_version
FROM app_control 
WHERE id = 1;

-- Step 2: Temporarily disable RLS to verify data exists
-- (This will show us if data is actually in the table)
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;

-- Count without RLS
SELECT 
  'Total rows (RLS disabled):' as info,
  COUNT(*) as count
FROM public.leads;

-- Show sample data
SELECT 
  id,
  customer_name,
  installation_town,
  created_at
FROM public.leads
LIMIT 5;

-- Step 3: Re-enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;

-- Step 4: Test the policy expression manually
-- This simulates what happens when the header is sent
-- Replace '3' with your actual app version to test
SELECT 
  'Testing policy with version 3:' as test,
  CASE 
    WHEN COALESCE(
      NULLIF('3', '')::int,
      0
    ) >= (SELECT min_app_version FROM app_control WHERE id = 1)
    THEN '✅ Policy would ALLOW access'
    ELSE '❌ Policy would BLOCK access'
  END as result;

-- Step 5: Test with version 0 (missing header)
SELECT 
  'Testing policy with version 0 (missing header):' as test,
  CASE 
    WHEN COALESCE(
      NULLIF('', '')::int,
      0
    ) >= (SELECT min_app_version FROM app_control WHERE id = 1)
    THEN '✅ Policy would ALLOW access'
    ELSE '❌ Policy would BLOCK access'
  END as result;

-- Step 6: Check if we can read the header in current context
-- (This will be NULL unless we're in a request context)
SELECT 
  'Current header value:' as info,
  current_setting('request.headers.x-app-version', true) as header_value;




