# Webhook Not Receiving Messages

## The Problem

- ✅ Table exists
- ✅ RLS is disabled
- ✅ Manual insert works
- ❌ Customer replies not being stored

**This means the webhook isn't receiving messages from Twilio!**

---

## Check 1: Is Webhook Being Called?

### Option A: Check Twilio Console

1. Go to **Twilio Console** → **Monitor** → **Logs** → **Webhooks**
2. Look for recent webhook calls to your Supabase URL
3. Check status codes:
   - **200** = Success (webhook received)
   - **500** = Error (webhook failed)
   - **No calls** = Webhook not configured or Twilio not sending

### Option B: Check Supabase Dashboard

1. Go to **Supabase Dashboard** → **Edge Functions** → **whatsapp-webhook**
2. Click **Logs** tab
3. See if there are any function invocations
4. If empty = Webhook not being called

---

## Check 2: Verify Webhook URL in Twilio

1. Go to **Twilio Console** → **Messaging** → **Settings** → **WhatsApp Sandbox** (or **WhatsApp Senders**)
2. Check the **Webhook URL** field
3. Should be: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/whatsapp-webhook`
4. Make sure:
   - ✅ Starts with `https://`
   - ✅ No trailing slash
   - ✅ Correct project ID
   - ✅ Function name is `whatsapp-webhook`

---

## Check 3: Test Webhook Directly

Send a test message from a customer's WhatsApp, then:

1. **Check Twilio Console** → **Monitor** → **Logs** → **Webhooks**
   - See if a webhook call was made
   - Check the request/response

2. **Check Supabase Dashboard** → **Edge Functions** → **whatsapp-webhook** → **Logs**
   - See if function was invoked
   - Check for any errors

---

## Most Likely Issues

1. **Webhook URL not configured in Twilio** - Check Twilio settings
2. **Wrong webhook URL** - Verify the URL is correct
3. **Webhook not deployed** - Redeploy the function
4. **Twilio not sending webhooks** - Check Twilio webhook settings

---

## Quick Fix Steps

1. **Verify webhook URL in Twilio** - Make sure it's correct
2. **Check Twilio webhook logs** - See if calls are being made
3. **Check Supabase function logs** - See if function is being invoked
4. **Redeploy webhook** (if needed):
   ```powershell
   npx supabase@latest functions deploy whatsapp-webhook
   ```

---

## Tell Me

1. **Are there webhook calls in Twilio Console?** (Monitor → Logs → Webhooks)
2. **Are there function invocations in Supabase Dashboard?** (Edge Functions → whatsapp-webhook → Logs)
3. **What's the webhook URL configured in Twilio?**

This will tell us if Twilio is calling your webhook!
