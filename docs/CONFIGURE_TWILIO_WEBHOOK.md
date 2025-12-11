# Configure Twilio Webhook - Final Step! ✅

Your webhook function is deployed! Now configure Twilio to use it.

---

## Your Function URL

```
https://mcpfqnccbszswlcxpcbq.supabase.co/functions/v1/whatsapp-webhook
```

Copy this URL - you'll need it in Twilio!

---

## Step-by-Step: Configure Twilio Webhook

### Step 1: Go to Twilio Console

1. Open [Twilio Console](https://console.twilio.com)
2. Make sure you're logged in

### Step 2: Navigate to WhatsApp Settings

**If using WhatsApp Sandbox:**

- Go to: **Messaging** → **Settings** → **WhatsApp Sandbox**

**If using WhatsApp Business API:**

- Go to: **Messaging** → **Try it out** → **Send a WhatsApp message**
- Click on your WhatsApp sender number
- Go to the **Configuration** tab

### Step 3: Set Webhook URL

1. Find the **Status Callback URL** field (or **Webhook URL**)
2. Paste your Function URL:
   ```
   https://mcpfqnccbszswlcxpcbq.supabase.co/functions/v1/whatsapp-webhook
   ```
3. Set HTTP method to: **POST**
4. Click **Save** or **Update**

---

## Visual Guide

### WhatsApp Sandbox:

1. **Messaging** (left sidebar)
2. **Settings** (under Messaging)
3. **WhatsApp Sandbox** (click it)
4. Scroll to find **Status Callback URL**
5. Paste: `https://mcpfqnccbszswlcxpcbq.supabase.co/functions/v1/whatsapp-webhook`
6. Make sure method is **POST**
7. Click **Save**

---

## What This Does

Now when a customer:

- ✅ Clicks "Yes Received" or "No Not Received" button
- ✅ Sends a text message reply

Twilio will send the message to your webhook → Your Edge Function processes it → Stores in database → Shows in your app!

---

## Test It!

1. **Send a test WhatsApp message** from your app to a customer
2. **Customer replies** (either button click or text)
3. **Check function logs:**
   ```powershell
   npx supabase@latest functions logs whatsapp-webhook
   ```
4. **Check database:**
   ```sql
   SELECT * FROM whatsapp_messages ORDER BY created_at DESC LIMIT 5;
   ```

---

## Troubleshooting

### Webhook not receiving messages?

1. **Check URL is correct:**
   - Must be: `https://mcpfqnccbszswlcxpcbq.supabase.co/functions/v1/whatsapp-webhook`
   - No trailing slash
   - Uses `https://` not `http://`

2. **Check HTTP method:**
   - Must be set to **POST**

3. **Check Twilio logs:**
   - Go to Twilio Console → **Monitor** → **Logs** → **Webhooks**
   - See if Twilio is trying to call your webhook
   - Check for error responses

4. **Check function logs:**
   ```powershell
   npx supabase@latest functions logs whatsapp-webhook
   ```

---

## You're Almost Done! 🎉

After configuring the webhook:

- ✅ Messages will be stored automatically
- ✅ Responses will appear in your database
- ✅ Your app can show them in real-time

Next: Update your Messages tab UI to show conversations!
