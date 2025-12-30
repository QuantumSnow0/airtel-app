-- Show all policies on leads table to identify conflicts
-- Run this first to see what the other policy is

SELECT 
  policyname as "Policy Name",
  cmd as "Operation (SELECT/INSERT/UPDATE/DELETE/ALL)",
  roles as "Roles (anon/public/etc)",
  qual as "USING expression",
  with_check as "WITH CHECK expression"
FROM pg_policies 
WHERE tablename = 'leads' AND schemaname = 'public'
ORDER BY policyname;

