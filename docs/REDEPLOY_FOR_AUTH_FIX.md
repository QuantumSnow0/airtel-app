# Fix: 401 Error - Redeploy Function After Config

## The Problem

The config file exists, but Supabase is still returning 401. This means **the function needs to be redeployed** for the config to take effect.

---

## Solution: Redeploy the Function

The `supabase.functions.config.json` file only takes effect **after redeployment**.

### Step 1: Redeploy the Function

```powershell
npx supabase@latest functions deploy whatsapp-webhook
```

This will:
- ✅ Upload the config file
- ✅ Apply the `"auth": false` setting
- ✅ Make the function publicly accessible

---

### Step 2: Verify Config is Applied

After deploying, check:

1. **Supabase Dashboard** → **Edge Functions** → **whatsapp-webhook**
2. Look for any settings or indicators that show auth is disabled
3. The function should now accept requests without Authorization header

---

### Step 3: Update Twilio Webhook URL

Make sure Twilio webhook URL is (without `?apikey=...`):

```
https://mcpfqnccbszswlcxpcbq.supabase.co/functions/v1/whatsapp-webhook
```

---

### Step 4: Test

1. Have a customer send a WhatsApp message
2. Check **Twilio Console** → Should show **200** (not 401)
3. Check **Supabase Dashboard** → Function logs should show "Received webhook"
4. Check **Database** → Messages should appear in `whatsapp_messages` table

---

## Why Redeploy is Needed

The config file (`supabase.functions.config.json`) is only read during deployment. Supabase applies the `"auth": false` setting when the function is deployed, not when the file is created.

---

## After Redeploying

The function should:
- ✅ Accept requests without Authorization header
- ✅ Work with Twilio webhooks
- ✅ Store messages in database

**Redeploy now and test!**








