# Fix: 401 Error - Add Anon Key to URL

## The Problem

Supabase Edge Functions require this header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

But **Twilio webhooks don't send custom headers!**

---

## Solution: Add Anon Key as Query Parameter

Update your Twilio webhook URL to include the anon key:

### Your Anon Key:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcGZxbmNjYnN6c3dsY3hwY2JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3Mzg3NjQsImV4cCI6MjA3OTMxNDc2NH0.P6JRi2PQAR45EmrKC0iu0IcoIwfdL32f1sm9o2h-JeQ
```

### Updated Twilio Webhook URL:

```
https://mcpfqnccbszswlcxpcbq.supabase.co/functions/v1/whatsapp-webhook?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcGZxbmNjYnN6c3dsY3hwY2JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3Mzg3NjQsImV4cCI6MjA3OTMxNDc2NH0.P6JRi2PQAR45EmrKC0iu0IcoIwfdL32f1sm9o2h-JeQ
```

---

## How to Update in Twilio

1. Go to **Twilio Console** → **Messaging** → **Settings** → **WhatsApp Sandbox** (or **WhatsApp Senders**)
2. Find the **Webhook URL** field
3. Replace with the URL above (with `?apikey=...` at the end)
4. Click **Save**

---

## Update Function to Accept Query Parameter

I need to update the function to check for the anon key in the query parameter and use it if the Authorization header is missing.

---

## After Updating

1. ✅ Redeploy the function
2. ✅ Update Twilio webhook URL with the anon key
3. ✅ Test with a customer message
4. ✅ Should see 200 (not 401)
5. ✅ Messages should be stored in database

---

## Security Note

The anon key is safe to use in URLs for webhooks because:

- It's the "public" key (not service_role)
- It respects Row Level Security (RLS)
- It's designed for client-side use

---

**Update the Twilio webhook URL with the anon key and test again!**
