# Deployment Guide - GPT-4o-mini Chatbot Migration v3.0.0

## Overview

This guide covers deploying the upgraded WhatsApp webhook with GPT-4o-mini chatbot functionality, including continuous conversation context, proactive follow-ups, and analytics tracking.

## Prerequisites

1. ✅ OpenAI API key (GPT-4o-mini-2024-07-18)
2. ✅ Supabase project with Edge Functions enabled
3. ✅ Database access for migrations
4. ✅ Twilio WhatsApp API configured

---

## Step 1: Database Migration

### 1.1 Add Analytics Fields

Run the migration script in Supabase SQL Editor:

```bash
# File: docs/database-migration-analytics.sql
```

This adds:

- `package_received` (yes/no/unknown)
- `customer_satisfaction` (satisfied/not_satisfied/unknown)
- `package_delivery_date` (timestamp)
- `satisfaction_response_date` (timestamp)
- `satisfaction_followup_sent` (boolean)

### 1.2 Backfill Historical Data

Run the backfill script to populate analytics from existing data:

```bash
# File: docs/database-backfill-analytics.sql
```

This populates:

- `package_received` from existing `whatsapp_response` field
- Historical delivery dates from `whatsapp_response_date`

---

## Step 2: Configure Environment Variables

Add to Supabase Edge Functions Secrets:

1. **OpenAI API Key:**
   - Name: `OPENAI_API_KEY`
   - Value: Your OpenAI API key
   - Get from: https://platform.openai.com/api-keys

2. **Verify existing secrets:**
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_WHATSAPP_NUMBER`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

**To add secrets:**

- Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets
- Click "Add new secret"
- Enter name and value

---

## Step 3: Deploy Updated Webhook Function

### Option A: Using Supabase CLI

```bash
# From project root
cd supabase/functions/whatsapp-webhook

# Deploy
supabase functions deploy whatsapp-webhook
```

### Option B: Using Supabase Dashboard

1. Go to Supabase Dashboard → Edge Functions
2. Select `whatsapp-webhook` function
3. Copy contents from `supabase/functions/whatsapp-webhook/index.ts`
4. Paste and save

---

## Step 4: Set Up Proactive Checkers (Optional)

The proactive checkers are included in the webhook function but need to be called periodically.

### Option A: Create Separate Scheduled Functions

Create two new Edge Functions:

1. `check-unanswered-messages` - Runs every 10 minutes
2. `followup-package-delivery` - Runs every 12 hours

### Option B: Use Supabase Cron (Recommended)

**Step 1: Enable pg_cron Extension**

First, enable the pg_cron extension in your Supabase database:

1. Go to Supabase Dashboard → Database → Extensions
2. Search for "pg_cron"
3. Click "Enable" (if not already enabled)

**OR** run this SQL in the SQL Editor:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

**Step 2: Set up cron jobs**

After enabling the extension, run these SQL commands:

```sql
-- Check unanswered messages every 10 minutes
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

-- Follow-up package delivery every 12 hours
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
```

**How to find YOUR_PROJECT_ID:**

1. Go to Supabase Dashboard → **Project Settings** → **General**
2. Look for **Reference ID** or **Project URL**
3. Your Project ID is the part before `.supabase.co` in your project URL
   - Example: If your URL is `https://abcdefghijklmnop.supabase.co`, then `abcdefghijklmnop` is your Project ID
4. Alternatively, check your `SUPABASE_URL` environment variable - it contains your Project ID

**How to find YOUR_SERVICE_ROLE_KEY:**

1. Go to Supabase Dashboard → **Project Settings** → **API**
2. Under **Project API keys**, find **`service_role`** key (⚠️ Keep this secret!)
3. Copy the key value

**Replace in the SQL above:**

- `YOUR_PROJECT_ID` → Your actual project reference ID
- `YOUR_SERVICE_ROLE_KEY` → Your actual service_role key

**Alternative: Direct Function Call (if pg_cron not available)**

If pg_cron is not available in your Supabase plan, you can create separate Edge Functions that can be called via external cron services (like GitHub Actions, cron-job.org, etc.):

1. Create `supabase/functions/check-unanswered-messages/index.ts`
2. Create `supabase/functions/followup-package-delivery/index.ts`
3. Deploy them as separate functions
4. Set up external cron to call them via HTTP

---

## Step 5: Verify Deployment

### 5.1 Test Webhook

1. Send a test WhatsApp message
2. Check Supabase Edge Function logs
3. Verify response is sent

### 5.2 Test Features

- ✅ Conversation context (send multiple messages)
- ✅ Rate limiting (send 21+ messages in one day)
- ✅ Escalation (test technical questions)
- ✅ Button clicks (yes_received/no_not_received)
- ✅ Analytics tracking (check database after button click)

---

## Step 6: Monitoring

### Monitor Logs

- Supabase Dashboard → Edge Functions → Logs
- Look for:
  - `[Proactive Checker]` logs
  - `[Package Follow-up]` logs
  - OpenAI API errors
  - Rate limiting triggers

### Monitor Costs

- OpenAI Dashboard: https://platform.openai.com/usage
- Track token usage and costs
- Expected: ~$7.50/month for 500 messages/day

### Monitor Analytics

Query analytics from `leads` table:

```sql
-- Package delivery stats
SELECT
  package_received,
  COUNT(*) as count
FROM leads
WHERE package_received IS NOT NULL
GROUP BY package_received;

-- Customer satisfaction stats
SELECT
  customer_satisfaction,
  COUNT(*) as count
FROM leads
WHERE customer_satisfaction IS NOT NULL
GROUP BY customer_satisfaction;
```

---

## Troubleshooting

### OpenAI API Errors

- Verify `OPENAI_API_KEY` is set correctly
- Check API key has access to GPT-4o-mini
- Verify billing is set up on OpenAI account

### Conversation Context Not Working

- Check `fetchConversationHistory()` is being called
- Verify messages are stored with correct `is_ai_response` flag
- Check database query logs

### Rate Limiting Issues

- Verify message count query is working
- Check if 20 messages/day limit is appropriate
- Adjust limit in `checkShouldAutoReply()` if needed

### Proactive Checkers Not Running

- Verify cron jobs are set up (if using Option B)
- Check function logs for errors
- Ensure functions are accessible

---

## Rollback Plan

If issues arise:

1. **Quick rollback:** Comment out new code, restore old `analyzeMessageWithAI` function
2. **Database rollback:** Analytics fields are nullable, safe to ignore
3. **Keep Gemini code:** Can restore Gemini API calls if needed

---

## Post-Deployment Checklist

- [ ] Database migration completed
- [ ] Historical data backfilled
- [ ] OpenAI API key configured
- [ ] Webhook function deployed
- [ ] Test messages working
- [ ] Conversation context verified
- [ ] Rate limiting tested
- [ ] Analytics tracking verified
- [ ] Proactive checkers configured (optional)
- [ ] Monitoring set up

---

## Support

For issues:

1. Check Supabase Edge Function logs
2. Check OpenAI API usage dashboard
3. Verify database schema matches migration
4. Review webhook function code

---

## Next Steps

1. Monitor performance and costs
2. Adjust conversation history limit if needed (currently 5 messages)
3. Tune escalation criteria based on real conversations
4. Set up alerts for high OpenAI costs
5. Review analytics data regularly
