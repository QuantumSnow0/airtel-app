# Check RLS and View Logs

## Step 3: Check RLS is Disabled

Since the table exists, check if RLS is blocking inserts:

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'whatsapp_messages';
```

**If `rowsecurity = true`, disable it:**
```sql
ALTER TABLE public.whatsapp_messages DISABLE ROW LEVEL SECURITY;
```

---

## View Webhook Logs (Alternative Method)

Since `functions logs` command doesn't work, use Supabase Dashboard:

1. Go to **Supabase Dashboard** → Your Project
2. Click **Edge Functions** in the left sidebar
3. Click on **whatsapp-webhook**
4. Click **Logs** tab
5. See all function executions and errors

**Look for:**
- "Received webhook" - Confirms webhook is getting messages
- "Error storing message in database" - See the exact error
- "Message stored successfully" - Confirms it worked

---

## Test Manual Insert

Verify the table works by inserting a test message:

```sql
INSERT INTO public.whatsapp_messages (
  customer_phone,
  message_body,
  message_type,
  direction,
  status
) VALUES (
  '+254724832555',
  'Test customer reply',
  'text',
  'inbound',
  'delivered'
);
```

**If this works:** Table is fine, issue is with webhook
**If this fails:** Check the error message

---

## Quick Fix

Most likely RLS is enabled. Run:

```sql
ALTER TABLE public.whatsapp_messages DISABLE ROW LEVEL SECURITY;
```

Then test again by having a customer send a message.



