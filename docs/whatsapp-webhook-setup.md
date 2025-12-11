# WhatsApp Response Webhook Setup Guide

## How It Works

When a customer clicks "Yes Received" or "No Not Received" on your WhatsApp message:

```
Customer clicks button
  ↓
Twilio receives the button click
  ↓
Twilio sends webhook to your Edge Function
  ↓
Edge Function processes the response
  ↓
Edge Function updates database
  ↓
Your app shows the response in real-time
```

## Step 1: Database Setup

First, add columns to store WhatsApp responses in the `leads` table:

```sql
-- Add columns to store WhatsApp response data
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS whatsapp_response TEXT NULL,
ADD COLUMN IF NOT EXISTS whatsapp_response_date TIMESTAMP WITH TIME ZONE NULL,
ADD COLUMN IF NOT EXISTS whatsapp_message_sent_date TIMESTAMP WITH TIME ZONE NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_response
ON public.leads(whatsapp_response)
WHERE whatsapp_response IS NOT NULL;
```

**Response values:**

- `"yes_received"` - Customer clicked "Yes Received"
- `"no_not_received"` - Customer clicked "No Not Received"
- `NULL` - No response yet

## Step 2: Create Supabase Edge Function

Create a new Edge Function called `whatsapp-webhook`:

```bash
supabase functions new whatsapp-webhook
```

Then deploy the function (see the function code below).

## Step 3: Configure Twilio Webhook

1. Go to [Twilio Console > Messaging > Settings > WhatsApp Sandbox](https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox)
2. Set the **Status Callback URL** to:
   ```
   https://YOUR_PROJECT_ID.supabase.co/functions/v1/whatsapp-webhook
   ```
3. Save the configuration

## Step 4: Test the Webhook

1. Send a test WhatsApp message from your app
2. Click a button on the received message
3. Check your database - the response should be stored

## Edge Function Code

See `supabase/functions/whatsapp-webhook/index.ts` for the full implementation.
