-- Create a queue table for pending auto-replies
-- This allows us to process auto-replies outside the webhook function

CREATE TABLE IF NOT EXISTS auto_reply_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES whatsapp_messages(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  message_type TEXT NOT NULL, -- 'button_click' or 'text'
  response_value TEXT, -- For button clicks: 'yes_received' or 'no_not_received'
  message_body TEXT, -- For text messages: the customer's message
  customer_id UUID REFERENCES leads(id),
  customer_name TEXT,
  delay_seconds INTEGER NOT NULL DEFAULT 30, -- Delay in seconds
  process_after TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '30 seconds'),
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Index for efficient querying of pending items
CREATE INDEX IF NOT EXISTS idx_auto_reply_queue_pending 
ON auto_reply_queue(process_after, status) 
WHERE status = 'pending';

-- Index for message lookup
CREATE INDEX IF NOT EXISTS idx_auto_reply_queue_message_id 
ON auto_reply_queue(message_id);





