-- Delete all WhatsApp messages for testing
-- Phone number: +254724832555

-- First, check what will be deleted (run this to see what you're deleting)
SELECT 
  id,
  customer_phone,
  message_body,
  direction,
  created_at,
  is_ai_response,
  needs_agent_review
FROM whatsapp_messages
WHERE customer_phone = '+254724832555'
ORDER BY created_at DESC;

-- Delete all messages for this phone number
DELETE FROM whatsapp_messages
WHERE customer_phone = '+254724832555';

-- Verify deletion (should return 0 rows)
SELECT COUNT(*) as remaining_messages
FROM whatsapp_messages
WHERE customer_phone = '+254724832555';

