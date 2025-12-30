-- Alternative App Version Gating (Since Supabase doesn't pass custom headers to RLS)
-- This uses a database function that the app calls to verify version

-- Step 1: Create function to check app version
-- The app will call this function and pass the version as a parameter
CREATE OR REPLACE FUNCTION check_app_version(app_version_param INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  min_version INT;
BEGIN
  -- Get minimum required version
  SELECT min_app_version INTO min_version
  FROM app_control
  WHERE id = 1;
  
  -- Return true if app version meets minimum requirement
  RETURN COALESCE(app_version_param, 0) >= COALESCE(min_version, 0);
END;
$$;

-- Step 2: Create a simpler RLS policy that allows access
-- We'll do version checking in the app code instead
-- For now, allow all access (we'll add version check in app)
CREATE POLICY "Allow anon access" ON public.leads
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Step 3: Grant execute permission on the function
GRANT EXECUTE ON FUNCTION check_app_version(INT) TO anon;

-- Step 4: Test the function
SELECT 
  'Testing version check function:' as test,
  check_app_version(3) as "Version 3 allowed?",
  check_app_version(1) as "Version 1 allowed?",
  check_app_version(0) as "Version 0 allowed?";

-- Notes:
-- 1. The app will call check_app_version(3) before making queries
-- 2. If it returns false, the app should show "Please update" message
-- 3. This is less secure than RLS (app can bypass), but it's the only way
--    since Supabase doesn't expose custom headers to RLS




