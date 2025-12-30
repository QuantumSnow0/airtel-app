-- Debug: Check if headers are accessible in RLS
-- This will help us understand if Supabase is passing the header correctly

-- Test 1: Try to read the header (will be NULL if not accessible)
SELECT 
  'Header access test:' as test,
  current_setting('request.headers.x-app-version', true) as header_value,
  CASE 
    WHEN current_setting('request.headers.x-app-version', true) IS NULL 
    THEN '❌ Header NOT accessible in RLS'
    ELSE '✅ Header IS accessible: ' || current_setting('request.headers.x-app-version', true)
  END as result;

-- Test 2: List all available request settings
SELECT 
  'Available request settings:' as info,
  name,
  setting
FROM pg_settings
WHERE name LIKE '%request%' OR name LIKE '%header%'
ORDER BY name;

-- Test 3: Try alternative header access methods
-- Method 1: Direct header access
SELECT 
  'Method 1 (direct):' as method,
  current_setting('request.headers.x-app-version', true) as value;

-- Method 2: Try without the 'true' parameter
SELECT 
  'Method 2 (no missing_ok):' as method,
  current_setting('request.headers.x-app-version') as value;

-- Note: If all return NULL, Supabase might not be passing custom headers to RLS
-- We may need to use a different approach (JWT claims, database functions, etc.)

