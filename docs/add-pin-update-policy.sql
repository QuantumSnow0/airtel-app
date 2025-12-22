-- Add UPDATE policy for leads table to allow pinning/unpinning conversations
-- Run this in Supabase SQL Editor

CREATE POLICY "Allow public updates"
ON leads
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

