-- Add WhatsApp response columns to leads table
-- Run this SQL in your Supabase SQL Editor

ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS whatsapp_response TEXT NULL,
ADD COLUMN IF NOT EXISTS whatsapp_response_date TIMESTAMP WITH TIME ZONE NULL,
ADD COLUMN IF NOT EXISTS whatsapp_message_sent_date TIMESTAMP WITH TIME ZONE NULL;

-- Create index for faster queries on responses
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_response 
ON public.leads(whatsapp_response) 
WHERE whatsapp_response IS NOT NULL;

-- Create index for response dates
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_response_date 
ON public.leads(whatsapp_response_date DESC) 
WHERE whatsapp_response_date IS NOT NULL;

-- Optional: Add check constraint for valid response values
ALTER TABLE public.leads 
DROP CONSTRAINT IF EXISTS leads_whatsapp_response_check;

ALTER TABLE public.leads 
ADD CONSTRAINT leads_whatsapp_response_check 
CHECK (
  whatsapp_response IS NULL OR 
  whatsapp_response IN ('yes_received', 'no_not_received', 'unknown')
);

