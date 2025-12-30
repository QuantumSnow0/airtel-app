-- Remove the blocking policy that's preventing access
-- This policy "block_all_anon_access_leads" has USING (false) which blocks all access

-- Drop the blocking policy
DROP POLICY IF EXISTS "block_all_anon_access_leads" ON public.leads;

-- Verify only the version gating policy remains
SELECT 
  policyname as "Policy Name",
  cmd as "Operation",
  roles as "Roles"
FROM pg_policies 
WHERE tablename = 'leads' AND schemaname = 'public'
ORDER BY policyname;

-- Expected result: Only "App version gating" policy should remain

