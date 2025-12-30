-- Check how many customers said "no" they haven't received the device
-- Run this in Supabase SQL Editor

-- STEP 1: Total count of records where customer said "no"
SELECT 
  COUNT(*) as total_records_with_no,
  COUNT(DISTINCT LOWER(TRIM(customer_name))) as unique_customers_with_no
FROM public.leads
WHERE 
  package_received = 'no' 
  OR whatsapp_response = 'no_not_received';

-- STEP 2: Breakdown by package_received field
SELECT 
  package_received,
  COUNT(*) as count,
  COUNT(DISTINCT LOWER(TRIM(customer_name))) as unique_customers
FROM public.leads
WHERE package_received = 'no'
GROUP BY package_received;

-- STEP 3: Breakdown by whatsapp_response field
SELECT 
  whatsapp_response,
  COUNT(*) as count,
  COUNT(DISTINCT LOWER(TRIM(customer_name))) as unique_customers
FROM public.leads
WHERE whatsapp_response = 'no_not_received'
GROUP BY whatsapp_response;

-- STEP 4: Combined breakdown showing both fields
SELECT 
  package_received,
  whatsapp_response,
  COUNT(*) as count,
  COUNT(DISTINCT LOWER(TRIM(customer_name))) as unique_customers
FROM public.leads
WHERE 
  package_received = 'no' 
  OR whatsapp_response = 'no_not_received'
GROUP BY package_received, whatsapp_response
ORDER BY count DESC;

-- STEP 5: Show sample of customer names who said "no" (first 20)
SELECT DISTINCT ON (LOWER(TRIM(customer_name)))
  customer_name,
  package_received,
  whatsapp_response,
  created_at
FROM public.leads
WHERE 
  package_received = 'no' 
  OR whatsapp_response = 'no_not_received'
ORDER BY LOWER(TRIM(customer_name)), created_at ASC
LIMIT 20;

