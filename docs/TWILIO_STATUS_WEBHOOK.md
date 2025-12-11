# Twilio Status Webhook Setup

## What This Does

Twilio can send status updates for messages:

- **sent** - Message was sent to Twilio
- **delivered** - Message was delivered to recipient
- **read** - Message was read by recipient (if read receipts enabled)
- **failed** - Message failed to send

## Setup Steps

### Step 1: Configure Status Callback in Twilio

1. Go to **Twilio Console** → **Messaging** → **Settings** → **WhatsApp Sandbox Settings**
2. Find **"Status Callback URL"** field
3. Enter your webhook URL:
   ```
   https://mcpfqnccbszswlcxpcbq.supabase.co/functions/v1/whatsapp-webhook
   ```
4. Save settings

### Step 2: Update Webhook Handler

The webhook handler needs to process status updates. It should:

- Check if the request is a status update (has `MessageStatus` field)
- Find the message by `MessageSid`
- Update the `status` field in `whatsapp_messages` table

### Step 3: Test

Send a message and check:

1. Status updates appear in Twilio Console
2. Database is updated with status
3. Chat UI shows correct checkmarks

## Status Values

- `queued` - Message is queued
- `sent` - Message sent to Twilio
- `delivered` - Message delivered to recipient
- `read` - Message read by recipient
- `failed` - Message failed

## Read Receipts

**Note:** Read receipts only work if:

- Recipient has read receipts enabled in WhatsApp
- You're using WhatsApp Business API (not Sandbox)
- Message was sent via approved template or in 24-hour window

In Sandbox mode, you'll typically only see `sent` and `delivered` statuses.
