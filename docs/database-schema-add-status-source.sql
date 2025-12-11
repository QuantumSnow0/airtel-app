-- Add status and source columns to leads table for WhatsApp auto-creation
-- Run this SQL in your Supabase SQL Editor

-- Add status column (for tracking new/unrecognized customers)
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS status TEXT NULL;

-- Add source column (for tracking where the lead came from)
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS source TEXT NULL;

-- Create index for faster queries on status
CREATE INDEX IF NOT EXISTS idx_leads_status 
ON public.leads(status) 
WHERE status IS NOT NULL;

-- Create index for faster queries on source
CREATE INDEX IF NOT EXISTS idx_leads_source 
ON public.leads(source) 
WHERE source IS NOT NULL;

-- Add comment to columns
COMMENT ON COLUMN public.leads.status IS 'Status of the lead: "new" for unrecognized customers from WhatsApp';
COMMENT ON COLUMN public.leads.source IS 'Source of the lead: "whatsapp_inbound" for auto-created leads from WhatsApp messages';

