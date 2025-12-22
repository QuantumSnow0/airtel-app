-- Backfill Analytics Data from Historical Records
-- Populates package_received and customer_satisfaction from existing data

-- Backfill package_received from whatsapp_response field
UPDATE leads
SET package_received = CASE
    WHEN whatsapp_response = 'yes_received' THEN 'yes'
    WHEN whatsapp_response = 'no_not_received' THEN 'no'
    ELSE 'unknown'
END,
package_delivery_date = CASE
    WHEN whatsapp_response = 'yes_received' AND whatsapp_response_date IS NOT NULL 
    THEN whatsapp_response_date
    ELSE NULL
END
WHERE package_received IS NULL OR package_received = 'unknown';

-- Note: Customer satisfaction will need to be extracted from conversation history
-- This can be done programmatically by analyzing whatsapp_messages table
-- For now, set all to 'unknown' and let the AI/system update as interactions occur

UPDATE leads
SET customer_satisfaction = 'unknown'
WHERE customer_satisfaction IS NULL;

-- Verify the backfill
SELECT 
    package_received,
    COUNT(*) as count
FROM leads
GROUP BY package_received;

SELECT 
    customer_satisfaction,
    COUNT(*) as count
FROM leads
GROUP BY customer_satisfaction;

