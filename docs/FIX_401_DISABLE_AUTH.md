# Fix: 401 Error - Disable Auth for Webhook

## The Solution

Supabase Edge Functions require authentication by default, but we can **disable JWT verification** for the webhook function to allow Twilio to call it without the Authorization header.

---

## Step 1: Config File Created

I've created a config file: `supabase/functions/whatsapp-webhook/supabase.functions.config.json`

This file contains:

```json
{
  "auth": false
}
```

This tells Supabase to allow unauthenticated requests to this function.

---

## Step 2: Redeploy the Function

After creating the config file, redeploy the function:

```powershell
npx supabase@latest functions deploy whatsapp-webhook
```

---

## Step 3: Update Twilio Webhook URL

Now you can use the **regular URL** (without the anon key):

```
https://mcpfqnccbszswlcxpcbq.supabase.co/functions/v1/whatsapp-webhook
```

**Remove the `?apikey=...` part** - it's not needed anymore!

---

## Step 4: Test

1. Have a customer send a WhatsApp message
2. Check **Twilio Console** → Should show **200** (not 401)
3. Check **Supabase Dashboard** → Function logs should show "Received webhook"
4. Check **Database** → Messages should appear in `whatsapp_messages` table

---

## Why This Works

The `supabase.functions.config.json` file with `"auth": false` tells Supabase to:

- ✅ Allow requests without Authorization header
- ✅ Make the function publicly accessible
- ✅ Perfect for webhooks from external services like Twilio

---

## Security Note

This is safe because:

- The function still uses SERVICE_ROLE_KEY internally for database operations
- Only this specific function is public
- The function validates the request comes from Twilio (via form data)

---

## After Redeploying

1. ✅ Update Twilio webhook URL (remove `?apikey=...`)
2. ✅ Test with a customer message
3. ✅ Should work now!

**Redeploy the function and test!**
