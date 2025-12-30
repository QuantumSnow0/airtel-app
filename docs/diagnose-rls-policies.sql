-- Diagnostic SQL to check RLS setup
-- Run this in Supabase SQL Editor to see current state

-- 1. Check if RLS is enabled and forced
SELECT 
  schemaname,
  tablename,
  rowsecurity as "RLS Enabled",
  CASE 
    WHEN (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'leads' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) 
    THEN 'YES' 
    ELSE 'NO' 
  END as "RLS Forced"
FROM pg_tables 
WHERE tablename = 'leads' AND schemaname = 'public';

-- 2. List all current RLS policies on leads table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as "USING expression",
  with_check as "WITH CHECK expression"
FROM pg_policies 
WHERE tablename = 'leads' AND schemaname = 'public';

-- 3. Check app_control table and min version
SELECT 
  id,
  min_app_version,
  'Current minimum version required' as description
FROM app_control 
WHERE id = 1;

-- 4. Check total row count (bypassing RLS with service role - for admin only)
-- NOTE: This will only work if you're using service role key
-- If using anon key, this will respect RLS and show 0 if policy blocks
SELECT COUNT(*) as "Total leads (respecting RLS)" FROM public.leads;

-- 5. Test if we can read the header (this will show NULL if not in request context)
SELECT 
  current_setting('request.headers.x-app-version', true) as "x-app-version header value";

-- 6. Check if there are any other policies that might conflict
SELECT 
  'Other policies found' as note,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'leads' 
  AND schemaname = 'public'
  AND policyname != 'App version gating';

