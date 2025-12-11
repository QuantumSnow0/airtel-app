-- Create WhatsApp Messages Table
-- This table stores all WhatsApp messages (both sent and received)
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NULL DEFAULT now(),
  
  -- Customer/Load information
  lead_id uuid NULL,
  customer_phone text NOT NULL,
  customer_name text NULL,
  
  -- Message details
  message_body text NOT NULL,
  message_sid text NULL, -- Twilio Message SID
  message_type text NOT NULL DEFAULT 'text', -- 'text', 'template', 'button_click'
  direction text NOT NULL, -- 'inbound' (from customer) or 'outbound' (to customer)
  
  -- For button clicks
  button_payload text NULL,
  button_text text NULL,
  
  -- For templates
  template_sid text NULL,
  template_variables jsonb NULL,
  
  -- Status tracking
  status text NULL DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
  error_message text NULL,
  
  CONSTRAINT whatsapp_messages_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_messages_direction_check CHECK (
    direction IN ('inbound', 'outbound')
  ),
  CONSTRAINT whatsapp_messages_type_check CHECK (
    message_type IN ('text', 'template', 'button_click', 'media')
  ),
  CONSTRAINT whatsapp_messages_status_check CHECK (
    status IN ('sent', 'delivered', 'read', 'failed', 'queued')
  )
) TABLESPACE pg_default;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_lead_id 
ON public.whatsapp_messages(lead_id) 
WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_customer_phone 
ON public.whatsapp_messages(customer_phone);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at 
ON public.whatsapp_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_direction 
ON public.whatsapp_messages(direction);

-- Foreign key to leads table (optional, can be NULL for messages from unknown numbers)
ALTER TABLE public.whatsapp_messages
DROP CONSTRAINT IF EXISTS whatsapp_messages_lead_id_fkey;

ALTER TABLE public.whatsapp_messages
ADD CONSTRAINT whatsapp_messages_lead_id_fkey 
FOREIGN KEY (lead_id) 
REFERENCES public.leads(id) 
ON DELETE SET NULL;

-- Add comment to table
COMMENT ON TABLE public.whatsapp_messages IS 'Stores all WhatsApp messages exchanged with customers';
COMMENT ON COLUMN public.whatsapp_messages.lead_id IS 'Links message to a customer/lead record';
COMMENT ON COLUMN public.whatsapp_messages.message_type IS 'Type of message: text, template, button_click, or media';
COMMENT ON COLUMN public.whatsapp_messages.direction IS 'Message direction: inbound (from customer) or outbound (to customer)';

