# Complete Status Webhook Setup Guide

## What I've Done

I've updated the `whatsapp-webhook` Edge Function to handle status updates. It now:

1. ✅ **Checks if request is a status update** - Looks for `MessageStatus` field
2. ✅ **Finds message by MessageSid** - Uses `message_sid` to find the message in database
3. ✅ **Updates status field** - Updates `status` in `whatsapp_messages` table

## Step 1: Redeploy the Webhook Function

The webhook handler has been updated. Redeploy it:

```powershell
npx supabase@latest functions deploy whatsapp-webhook
```

## Step 2: Configure Status Callback in Twilio

### Option A: Global WhatsApp Settings (Recommended)

1. Go to **Twilio Console** → **Messaging** → **Settings** → **WhatsApp Sandbox Settings**
2. Find **"Status Callback URL"** field
3. Enter your webhook URL:
   ```
   https://mcpfqnccbszswlcxpcbq.supabase.co/functions/v1/whatsapp-webhook
   ```
4. Click **Save**

### Option B: Per-Message Status Callback

When sending messages via Edge Functions, you can also add `StatusCallback` parameter to each message. But the global setting is easier.

## Step 3: Test

1. **Send a message** from your app to a customer
2. **Check Twilio Console** → **Monitor** → **Logs** → **Messaging**
   - You should see status updates: `queued` → `sent` → `delivered`
3. **Check Supabase Database**:
   ```sql
   SELECT message_sid, status, created_at 
   FROM whatsapp_messages 
   WHERE direction = 'outbound' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```
   - Status should update from `sent` → `delivered` (and `read` if enabled)
4. **Check Chat UI**:
   - Single gray check = sent
   - Double gray checks = delivered
   - Double blue checks = read

## How It Works

### Status Update Flow:

1. **You send message** → Edge Function sends to Twilio
2. **Twilio processes** → Message status changes
3. **Twilio sends webhook** → Status callback to your webhook URL
4. **Webhook receives** → Detects `MessageStatus` field (no `From` field)
5. **Webhook updates database** → Finds message by `MessageSid` and updates `status`
6. **App updates in real-time** → Supabase Realtime subscription shows new status
7. **UI updates** → Checkmarks change color based on status

### Status Values:

- `queued` - Message queued by Twilio
- `sent` - Message sent to WhatsApp
- `delivered` - Message delivered to recipient's phone
- `read` - Message read by recipient (requires read receipts enabled)
- `failed` - Message failed to send

## Read Receipts Note

**Read receipts (`read` status) only work if:**
- Recipient has read receipts enabled in WhatsApp
- You're using WhatsApp Business API (not Sandbox)
- Message was sent within 24-hour window or via approved template

In **Sandbox mode**, you'll typically only see:
- `sent` ✅
- `delivered` ✅✅
- `read` ✅✅ (blue) - Usually not available in Sandbox

## Troubleshooting

### Status updates not appearing?

1. **Check Twilio Console** → **Monitor** → **Logs** → **Messaging**
   - Look for status callback requests
   - Check if they're successful (200) or failing

2. **Check Supabase Edge Function Logs**:
   - Go to **Supabase Dashboard** → **Edge Functions** → **whatsapp-webhook** → **Logs**
   - Look for "Processing status update" messages

3. **Verify Status Callback URL**:
   - Make sure it's exactly: `https://mcpfqnccbszswlcxpcbq.supabase.co/functions/v1/whatsapp-webhook`
   - No trailing slash
   - No extra parameters

4. **Check Database**:
   - Verify `message_sid` is being stored when messages are sent
   - Status updates need `message_sid` to find the message

## Next Steps

1. ✅ **Redeploy the webhook function** (if you haven't already)
2. ✅ **Configure Status Callback URL in Twilio**
3. ✅ **Test by sending a message**
4. ✅ **Check that status updates appear in database**
5. ✅ **Verify checkmarks update in chat UI**

**You're all set!** Status updates should now work automatically. 🎉







