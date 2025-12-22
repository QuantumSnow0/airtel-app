# How to Enable pg_cron in Supabase

## Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **Database** → **Extensions**
3. Search for **"pg_cron"**
4. Click the **Enable** button
5. Wait for the extension to be enabled

## Option 2: Via SQL Editor

1. Go to Supabase Dashboard → **SQL Editor**
2. Run this command:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

3. Click **Run** to execute

## Verify Extension is Enabled

Run this query to verify:

```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

If the extension is enabled, you'll see a row returned.

## Check Existing Cron Jobs

To see if any cron jobs are already scheduled:

```sql
SELECT * FROM cron.job;
```

## Note About Supabase Plans

- **pg_cron** is available on **Pro** plan and above
- If you're on the **Free** plan, you may need to upgrade or use an external cron service
- Contact Supabase support if you're unsure about your plan's capabilities

## Alternative: External Cron Services

If pg_cron is not available, you can use external services like:

- GitHub Actions (free)
- cron-job.org (free tier available)
- Vercel Cron (if using Vercel)
- Any service that can make HTTP requests on a schedule

The proactive checker functions can be called directly via HTTP:

- `POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/check-unanswered-messages`
- `POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/followup-package-delivery`

(Note: You'll need to create these as separate Edge Functions first)
