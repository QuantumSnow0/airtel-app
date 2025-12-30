-- Copy unique customers to leads_resubmit table
-- This script copies ONE record per unique customer (the first occurrence)
-- Run this in Supabase SQL Editor

-- STEP 1: Clear the table first (if you want to start fresh)
DELETE FROM public.leads_resubmit;

-- STEP 2: Copy unique customers to leads_resubmit
-- This uses the EXACT 59 customer names from duplicate-registrations-summary.md
-- Gets exactly ONE record per unique customer_name (the earliest one)
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
  is_pinned
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
  is_pinned
FROM public.leads
WHERE LOWER(TRIM(customer_name)) IN (
  -- Exact 59 unique customer names from duplicate-registrations-summary.md
  'alban',
  'alban osembo',
  'alex wambugu',
  'awuor sylivia',
  'bonface',
  'cecilia nakhayami',
  'cherop vicky',
  'collins obel',
  'david munuve',
  'david ngugi kinyanjui',
  'dennis nderitu',
  'edger',
  'emmanuel samusi',
  'enoch macharia',
  'felix',
  'fundi nassir',
  'gabriel khasavuli',
  'geoffrey osoro onyiego',
  'gladys gichuru',
  'henric amokola',
  'henrick amokola',
  'ian john odinga',
  'isaac kamau',
  'isaac muturi kangethe',
  'jack omondi omulo',
  'joel gechara momanyi',
  'joel momanyi',
  'joshua muuo mutunga',
  'kevin khasewa',
  'kevin khasewa saul',
  'kevin nyingi',
  'kevin ongera omwenga',
  'lawrence wakamami',
  'leslie masolia',
  'lilian mwikali mwongela',
  'lucy kuria',
  'melva njoki',
  'mercy chepkoech',
  'mercy kalunga muema',
  'michael njoroge muthanji',
  'miss kirui priscah',
  'mwitha wanyathaye nduti',
  'nemwel',
  'nemwel peter',
  'njeru e macharia',
  'peterson',
  'peterson oigo',
  'pius omadede',
  'pravin',
  'priscah kirui',
  'rachael agona',
  'rose namudh muturi',
  'samson njoroge',
  'samuel muthui',
  'samuel muthui mwema',
  'shila',
  'sylvia awuor',
  'unknown customer',
  'victory thomas'
)
ORDER BY LOWER(TRIM(customer_name)), created_at ASC;

-- STEP 3: Verify the count (should be around 59 unique customers)
SELECT COUNT(*) as total_copied FROM public.leads_resubmit;

-- STEP 4: See the list of unique customers copied
SELECT 
  LOWER(TRIM(customer_name)) as unique_name,
  COUNT(*) as count
FROM public.leads_resubmit
GROUP BY LOWER(TRIM(customer_name))
ORDER BY unique_name;

-- Alternative approach: If you want to copy specific IDs from your duplicate analysis
-- Replace the entire SELECT query above with:
/*
INSERT INTO public.leads_resubmit (
  created_at, customer_name, airtel_number, alternate_number, email,
  preferred_package, installation_town, delivery_landmark, visit_date, visit_time,
  agent_type, enterprise_cp, agent_name, agent_mobile, lead_type, connection_type,
  ms_forms_response_id, ms_forms_submitted_at, submission_status,
  status, source, whatsapp_response, whatsapp_response_date, whatsapp_message_sent_date, is_pinned
)
SELECT 
  created_at, customer_name, airtel_number, alternate_number, email,
  preferred_package, installation_town, delivery_landmark, visit_date, visit_time,
  agent_type, enterprise_cp, agent_name, agent_mobile, lead_type, connection_type,
  NULL, NULL, 'pending',
  status, source, whatsapp_response, whatsapp_response_date, whatsapp_message_sent_date, is_pinned
FROM public.leads
WHERE id IN (
  -- Paste your specific IDs here from duplicate-registrations-summary.md
  'id1', 'id2', 'id3', ...
);
*/

