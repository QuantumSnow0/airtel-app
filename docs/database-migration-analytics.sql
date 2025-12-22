-- Database Migration: Analytics & Metrics Tracking
-- Adds fields for tracking package delivery and customer satisfaction

-- Add analytics fields to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS package_received TEXT CHECK (package_received IN ('yes', 'no', 'unknown')),
ADD COLUMN IF NOT EXISTS customer_satisfaction TEXT CHECK (customer_satisfaction IN ('satisfied', 'not_satisfied', 'unknown')),
ADD COLUMN IF NOT EXISTS package_delivery_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS satisfaction_response_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS satisfaction_followup_sent BOOLEAN DEFAULT FALSE;

-- Set default values for existing records
UPDATE leads
SET package_received = 'unknown'
WHERE package_received IS NULL;

UPDATE leads
SET customer_satisfaction = 'unknown'
WHERE customer_satisfaction IS NULL;

UPDATE leads
SET satisfaction_followup_sent = FALSE
WHERE satisfaction_followup_sent IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_package_received ON leads(package_received);
CREATE INDEX IF NOT EXISTS idx_leads_customer_satisfaction ON leads(customer_satisfaction);
CREATE INDEX IF NOT EXISTS idx_leads_package_delivery_date ON leads(package_delivery_date);

-- Add comment to columns
COMMENT ON COLUMN leads.package_received IS 'Track if customer received package: yes, no, or unknown';
COMMENT ON COLUMN leads.customer_satisfaction IS 'Track customer satisfaction: satisfied, not_satisfied, or unknown';
COMMENT ON COLUMN leads.package_delivery_date IS 'Timestamp when package was received';
COMMENT ON COLUMN leads.satisfaction_response_date IS 'Timestamp when satisfaction was recorded';
COMMENT ON COLUMN leads.satisfaction_followup_sent IS 'Prevent duplicate satisfaction surveys';

