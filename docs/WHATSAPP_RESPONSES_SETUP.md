# WhatsApp Response Tracking - Complete Setup Guide

## Overview

This guide explains how to set up customer response tracking for WhatsApp messages. When customers click "Yes Received" or "No Not Received" buttons, their responses are automatically saved and displayed in your app.

---

## Setup Steps

### Step 1: Update Database Schema

Run this SQL in your Supabase SQL Editor to add response tracking columns:

```sql
-- Add WhatsApp response columns to leads table
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS whatsapp_response TEXT NULL,
ADD COLUMN IF NOT EXISTS whatsapp_response_date TIMESTAMP WITH TIME ZONE NULL,
ADD COLUMN IF NOT EXISTS whatsapp_message_sent_date TIMESTAMP WITH TIME ZONE NULL;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_response
ON public.leads(whatsapp_response)
WHERE whatsapp_response IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_response_date
ON public.leads(whatsapp_response_date DESC)
WHERE whatsapp_response_date IS NOT NULL;

-- Add constraint for valid response values
ALTER TABLE public.leads
DROP CONSTRAINT IF EXISTS leads_whatsapp_response_check;

ALTER TABLE public.leads
ADD CONSTRAINT leads_whatsapp_response_check
CHECK (
  whatsapp_response IS NULL OR
  whatsapp_response IN ('yes_received', 'no_not_received', 'unknown')
);
```

**File location:** See `docs/database-schema-whatsapp-responses.sql`

---

### Step 2: Deploy Webhook Edge Function

1. **Create the Edge Function:**

   ```bash
   supabase functions new whatsapp-webhook
   ```

2. **Copy the function code:**
   - File: `supabase/functions/whatsapp-webhook/index.ts`
   - This function receives button clicks from Twilio and updates your database

3. **Set Environment Variables in Supabase:**

   Go to Supabase Dashboard > Project Settings > Edge Functions > Secrets

   Add these secrets (they should already exist from the send-whatsapp-message function):
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Your service role key (for database updates)

4. **Deploy the function:**

   ```bash
   supabase functions deploy whatsapp-webhook
   ```

   Or use the Supabase Dashboard to deploy.

---

### Step 3: Configure Twilio Webhook

1. **Go to Twilio Console:**
   - Navigate to: [Messaging > Settings > WhatsApp Sandbox](https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox)

2. **Set the Status Callback URL:**

   ```
   https://YOUR_PROJECT_ID.supabase.co/functions/v1/whatsapp-webhook
   ```

   Replace `YOUR_PROJECT_ID` with your actual Supabase project ID.

3. **Save the configuration**

---

## How It Works

```
Customer clicks "Yes Received" or "No Not Received"
  ↓
Twilio receives the button click
  ↓
Twilio sends webhook POST request to your Edge Function
  ↓
Edge Function finds customer by phone number
  ↓
Edge Function updates database with response
  ↓
Your app shows the response in real-time (via Supabase Realtime)
```

---

## Response Values

- **`yes_received`** - Customer clicked "Yes Received"
- **`no_not_received`** - Customer clicked "No Not Received"
- **`null`** - No response yet

---

## Viewing Responses in the App

Responses are automatically displayed in the **Messages** tab:

1. ✅ **Green checkmark + "Yes Received"** - Customer confirmed
2. ❌ **Red X + "No Not Received"** - Customer denied
3. 📅 **Response date** - When the customer responded

The app updates in **real-time** when responses come in (via Supabase Realtime).

---

## Testing

1. **Send a test message** from your app to a customer
2. **Click a button** on the received WhatsApp message (Yes/No)
3. **Check your app** - the response should appear automatically
4. **Check your database** - verify the response was saved:
   ```sql
   SELECT
     customer_name,
     whatsapp_response,
     whatsapp_response_date
   FROM public.leads
   WHERE whatsapp_response IS NOT NULL;
   ```

---

## Troubleshooting

### Responses not appearing?

1. **Check webhook URL** in Twilio - must match your Edge Function URL
2. **Check Edge Function logs** in Supabase Dashboard
3. **Verify database columns** exist (run Step 1 SQL again)
4. **Check phone number matching** - webhook matches by phone number format

### Phone number not matching?

The webhook tries multiple phone number formats:

- `+254...`
- `254...`
- `0...`
- Checks both `airtel_number` and `alternate_number`

If still not matching, check the Edge Function logs for the phone number format received.

---

## Files Created

1. **`supabase/functions/whatsapp-webhook/index.ts`** - Webhook handler
2. **`docs/database-schema-whatsapp-responses.sql`** - Database schema updates
3. **`docs/whatsapp-webhook-setup.md`** - Detailed setup guide
4. **`app/(tabs)/messages.tsx`** - Updated to show responses

---

## Next Steps

- ✅ Database columns added
- ✅ Edge Function created
- ✅ Messages tab updated to show responses
- ⏳ Deploy Edge Function
- ⏳ Configure Twilio webhook
- ⏳ Test end-to-end
