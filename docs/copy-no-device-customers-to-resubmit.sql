-- Copy customers who haven't received device to leads_resubmit table
-- This script copies customers where:
--   - package_received = 'no' OR
--   - whatsapp_response = 'no_not_received'
-- Gets ONE record per unique customer (the earliest one)
-- Excludes customers already in leads_resubmit
-- Run this in Supabase SQL Editor

-- STEP 0: Pre-check - Show what will be skipped and what will be added
SELECT 
  'Customers already in leads_resubmit (will be SKIPPED)' as status,
  COUNT(DISTINCT LOWER(TRIM(customer_name))) as unique_customers
FROM public.leads
WHERE 
  (
    package_received = 'no' 
    OR whatsapp_response = 'no_not_received'
  )
  AND LOWER(TRIM(customer_name)) IN (
    SELECT DISTINCT LOWER(TRIM(customer_name))
    FROM public.leads_resubmit
  )
UNION ALL
SELECT 
  'New customers to be ADDED' as status,
  COUNT(DISTINCT LOWER(TRIM(customer_name))) as unique_customers
FROM public.leads
WHERE 
  (
    package_received = 'no' 
    OR whatsapp_response = 'no_not_received'
  )
  AND LOWER(TRIM(customer_name)) NOT IN (
    SELECT DISTINCT LOWER(TRIM(customer_name))
    FROM public.leads_resubmit
  );

-- STEP 1: Copy customers who haven't received device
-- This uses DISTINCT ON to get exactly ONE record per unique customer_name (the earliest one)
-- Only copies customers NOT already in leads_resubmit
INSERT INTO public.leads_resubmit (
  created_at,
  customer_name,
  airtel_number,
  alternate_number,
  email,
  preferred_package,
  installation_town,
  delivery_landmark,
  visit_date,
  visit_time,
  agent_type,
  enterprise_cp,
  agent_name,
  agent_mobile,
  lead_type,
  connection_type,
  ms_forms_response_id,
  ms_forms_submitted_at,
  submission_status,
  status,
  source,
  whatsapp_response,
  whatsapp_response_date,
  whatsapp_message_sent_date,
  is_pinned,
  resubmit_count,
  last_resubmitted_at
)
SELECT DISTINCT ON (LOWER(TRIM(customer_name)))
  created_at,
  customer_name,
  airtel_number,
  alternate_number,
  email,
  preferred_package,
  installation_town,
  delivery_landmark,
  visit_date,
  visit_time,
  agent_type,
  enterprise_cp,
  agent_name,
  agent_mobile,
  lead_type,
  connection_type,
  NULL as ms_forms_response_id,  -- Clear MS Forms data for resubmission
  NULL as ms_forms_submitted_at,
  'pending' as submission_status,
  status,
  source,
  whatsapp_response,
  whatsapp_response_date,
  whatsapp_message_sent_date,
  is_pinned,
  0 as resubmit_count,  -- Initialize resubmit count
  NULL as last_resubmitted_at  -- No resubmission yet
FROM public.leads
WHERE 
  -- Customer hasn't received device
  (
    package_received = 'no' 
    OR whatsapp_response = 'no_not_received'
  )
  -- Exclude customers already in leads_resubmit
  AND LOWER(TRIM(customer_name)) NOT IN (
    SELECT DISTINCT LOWER(TRIM(customer_name))
    FROM public.leads_resubmit
  )
ORDER BY LOWER(TRIM(customer_name)), created_at ASC;

-- STEP 2: Show summary of what was just copied (new records)
SELECT 
  'Total records in leads_resubmit' as metric,
  COUNT(*) as count
FROM public.leads_resubmit
UNION ALL
SELECT 
  'Unique customers in leads_resubmit' as metric,
  COUNT(DISTINCT LOWER(TRIM(customer_name))) as count
FROM public.leads_resubmit
UNION ALL
SELECT 
  'Pending records (ready for resubmission)' as metric,
  COUNT(*) as count
FROM public.leads_resubmit
WHERE submission_status = 'pending';

-- STEP 3: Show breakdown by package_received and whatsapp_response
SELECT 
  package_received,
  whatsapp_response,
  COUNT(*) as count
FROM public.leads
WHERE 
  (
    package_received = 'no' 
    OR whatsapp_response = 'no_not_received'
  )
  AND LOWER(TRIM(customer_name)) IN (
    SELECT DISTINCT LOWER(TRIM(customer_name))
    FROM public.leads_resubmit
  )
GROUP BY package_received, whatsapp_response
ORDER BY count DESC;


