-- Setup Proactive Checkers using pg_cron
-- Run this AFTER enabling pg_cron extension

-- Step 1: Enable pg_cron extension (run this first if not already enabled)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 2: Schedule unanswered messages checker (every 10 minutes)
SELECT cron.schedule(
  'check-unanswered-messages',
  '*/10 * * * *', -- Every 10 minutes
  $$
  SELECT net.http_post(
    url:='https://YOUR_PROJECT_ID.supabase.co/functions/v1/check-unanswered-messages',
    headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  ) AS request_id;
  $$
);

-- Step 3: Schedule package delivery follow-up (every 12 hours)
SELECT cron.schedule(
  'followup-package-delivery',
  '0 */12 * * *', -- Every 12 hours
  $$
  SELECT net.http_post(
    url:='https://YOUR_PROJECT_ID.supabase.co/functions/v1/followup-package-delivery',
    headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  ) AS request_id;
  $$
);

-- To check if cron jobs are scheduled:
-- SELECT * FROM cron.job;

-- To unschedule a cron job:
-- SELECT cron.unschedule('check-unanswered-messages');
-- SELECT cron.unschedule('followup-package-delivery');





