# Fix: Webhook 401 Error - Wrong URL

## The Problem

Your Twilio webhook URL is **WRONG**:

❌ **Current (Wrong):**

```
https://mcpfqnccbszswlcxpcbq.supabase.co/function5/12/0807099-01
```

✅ **Should Be:**

```
https://mcpfqnccbszswlcxpcbq.supabase.co/functions/v1/whatsapp-webhook
```

---

## How to Fix

### Step 1: Go to Twilio WhatsApp Settings

1. Go to **Twilio Console**
2. **Messaging** → **Settings** → **WhatsApp Sandbox** (or **WhatsApp Senders**)
3. Find the **Webhook URL** field

### Step 2: Update the URL

**Replace the current URL with:**

```
https://mcpfqnccbszswlcxpcbq.supabase.co/functions/v1/whatsapp-webhook
```

**Important:**

- ✅ Must start with `https://`
- ✅ No trailing slash
- ✅ Exact path: `/functions/v1/whatsapp-webhook`
- ✅ No spaces

### Step 3: Save

Click **Save** to update the webhook URL.

---

## Verify It's Fixed

1. Have a customer send a WhatsApp message
2. Check **Twilio Console** → **Monitor** → **Logs** → **Messaging**
3. Look for webhook calls - should show **200** status (not 401)
4. Check **Supabase Dashboard** → **Edge Functions** → **whatsapp-webhook** → **Logs**
5. Should see "Received webhook" and "Message stored successfully"

---

## Why This Happened

The URL got corrupted or was set incorrectly. The correct format for Supabase Edge Functions is:

```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/FUNCTION_NAME
```

Where:

- `YOUR_PROJECT_ID` = `mcpfqnccbszswlcxpcbq`
- `FUNCTION_NAME` = `whatsapp-webhook`

---

## After Fixing

Once you update the URL:

1. ✅ Webhook will receive messages
2. ✅ Messages will be stored in database
3. ✅ You'll see customer replies in `whatsapp_messages` table

**Update the URL in Twilio and test again!**
