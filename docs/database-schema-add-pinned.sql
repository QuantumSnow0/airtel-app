-- Add is_pinned field to leads table for pinning important conversations
-- Run this migration in Supabase SQL Editor

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- Create index for faster queries on pinned conversations
CREATE INDEX IF NOT EXISTS idx_leads_is_pinned ON leads(is_pinned);

-- Update existing records to have is_pinned = false
UPDATE leads SET is_pinned = FALSE WHERE is_pinned IS NULL;

