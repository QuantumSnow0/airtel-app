-- Add bypass_duplicate_check column to leads table and create leads_resubmit table
-- Run this SQL in your Supabase SQL Editor

-- ============================================
-- Step 1: Add bypass_duplicate_check column to leads table
-- ============================================

ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS bypass_duplicate_check BOOLEAN DEFAULT false;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_leads_bypass_duplicate_check 
ON public.leads(bypass_duplicate_check) 
WHERE bypass_duplicate_check = true;

-- Add comment
COMMENT ON COLUMN public.leads.bypass_duplicate_check IS 'If true, this lead will not be marked as duplicate in the app. Used for resubmitted leads.';

-- ============================================
-- Step 2: Create leads_resubmit table
-- ============================================

-- Drop constraint if it exists (in case table was partially created)
ALTER TABLE IF EXISTS public.leads_resubmit 
DROP CONSTRAINT IF EXISTS leads_resubmit_submission_status_check;

CREATE TABLE IF NOT EXISTS public.leads_resubmit (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NULL DEFAULT now(),
  
  -- Customer information
  customer_name text NOT NULL,
  airtel_number text NOT NULL,
  alternate_number text NOT NULL,
  email text NOT NULL,
  
  -- Package and location
  preferred_package text NOT NULL,
  installation_town text NOT NULL,
  delivery_landmark text NOT NULL,
  
  -- Installation schedule
  visit_date date NOT NULL,
  visit_time text NOT NULL,
  
  -- Internal agent data (auto-filled)
  agent_type text NOT NULL,
  enterprise_cp text NOT NULL,
  agent_name text NOT NULL,
  agent_mobile text NOT NULL,
  lead_type text NOT NULL,
  connection_type text NOT NULL,
  
  -- Microsoft Forms submission tracking
  ms_forms_response_id integer NULL,
  ms_forms_submitted_at timestamp with time zone NULL,
  submission_status text NULL DEFAULT 'pending',
  
  -- Additional columns (from later migrations)
  status text NULL,
  source text NULL,
  whatsapp_response text NULL,
  whatsapp_response_date timestamp with time zone NULL,
  whatsapp_message_sent_date timestamp with time zone NULL,
  is_pinned boolean DEFAULT false,
  
  CONSTRAINT leads_resubmit_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- Add the check constraint separately (after table creation)
-- Drop first if exists, then add
ALTER TABLE public.leads_resubmit
DROP CONSTRAINT IF EXISTS leads_resubmit_submission_status_check;

ALTER TABLE public.leads_resubmit
ADD CONSTRAINT leads_resubmit_submission_status_check CHECK (
  (submission_status = ANY (
    ARRAY['pending'::text, 'submitted'::text, 'failed'::text]
  ))
);

-- ============================================
-- Step 3: Create indexes for leads_resubmit
-- ============================================

CREATE INDEX IF NOT EXISTS idx_leads_resubmit_created_at 
ON public.leads_resubmit USING btree (created_at DESC) 
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_leads_resubmit_submission_status 
ON public.leads_resubmit USING btree (submission_status) 
TABLESPACE pg_default;

-- ============================================
-- Step 4: Row Level Security (DISABLED for privacy)
-- ============================================
-- 
-- RLS is DISABLED to keep this table private from other app users.
-- Access will be controlled via API endpoints using service role key.
-- The app client will NEVER query this table directly.

ALTER TABLE public.leads_resubmit DISABLE ROW LEVEL SECURITY;

-- Note: If you need to enable RLS later, you can create policies like this:
-- (But for privacy, keep RLS disabled and use service role key in API)
--
-- ALTER TABLE public.leads_resubmit ENABLE ROW LEVEL SECURITY;
-- 
-- DROP POLICY IF EXISTS "Allow public inserts" ON public.leads_resubmit;
-- CREATE POLICY "Allow public inserts" ON public.leads_resubmit
--   FOR INSERT
--   WITH CHECK (true);
--
-- DROP POLICY IF EXISTS "Allow public reads" ON public.leads_resubmit;
-- CREATE POLICY "Allow public reads" ON public.leads_resubmit
--   FOR SELECT
--   USING (true);
--
-- DROP POLICY IF EXISTS "Allow public updates" ON public.leads_resubmit;
-- CREATE POLICY "Allow public updates" ON public.leads_resubmit
--   FOR UPDATE
--   USING (true);
--
-- DROP POLICY IF EXISTS "Allow public deletes" ON public.leads_resubmit;
-- CREATE POLICY "Allow public deletes" ON public.leads_resubmit
--   FOR DELETE
--   USING (true);

-- ============================================
-- Notes
-- ============================================
-- 
-- This migration:
-- 1. Adds bypass_duplicate_check column to leads table
-- 2. Creates leads_resubmit table with same structure as leads table
-- 3. Sets up indexes
-- 4. DISABLES RLS for privacy (other app users won't see this data)
--
-- The leads_resubmit table is used to store unique customer records
-- that need to be resubmitted to Microsoft Forms and the leads table
-- without triggering duplicate detection.
--
-- PRIVACY NOTE:
-- - RLS is DISABLED on leads_resubmit table
-- - Access this table ONLY via API endpoints using SERVICE ROLE KEY
-- - NEVER query this table from the app client (React Native app)
-- - This ensures other app users cannot see or access this data
-- - Only your backend API (with service role key) can access it

