# Fix: 401 Error - Missing Authorization Header

## The Problem

✅ URL is correct: `https://mcpfqnccbszswlcxpcbq.supabase.co/functions/v1/whatsapp-webhook`
❌ Getting 401 "Missing authorization header"

**Supabase Edge Functions require authentication by default!**

---

## Solution: Check Supabase Dashboard for Invoke URL

Supabase provides a special "Invoke URL" that might handle auth automatically.

### Step 1: Get the Correct URL from Supabase

1. Go to **Supabase Dashboard** → **Edge Functions**
2. Click on **whatsapp-webhook**
3. Look for **"Invoke URL"** or **"Public URL"**
4. Copy that URL (it might be different from the regular URL)

### Step 2: Update Twilio Webhook

Use the **Invoke URL** from Supabase Dashboard in Twilio instead of the regular URL.

---

## Alternative: Add Anon Key to URL (If Supported)

Some Supabase setups allow passing the anon key as a query parameter:

```
https://mcpfqnccbszswlcxpcbq.supabase.co/functions/v1/whatsapp-webhook?apikey=YOUR_ANON_KEY
```

**But check Supabase Dashboard first for the correct Invoke URL!**

---

## Most Likely Fix

**The Supabase Dashboard should show a special "Invoke URL"** that handles authentication automatically. Use that URL in Twilio.

**Check:**
1. Supabase Dashboard → Edge Functions → whatsapp-webhook
2. Look for "Invoke URL" or "Public URL"
3. Copy and use that in Twilio

---

## Tell Me

**What URL does Supabase Dashboard show for the function?** (Check the "Invoke URL" or "Public URL" field)

That's the URL we should use in Twilio!



