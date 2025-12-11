# Debug: Customer Replies Not Stored

## Step 1: Check Webhook Logs (DO THIS FIRST!)

This will show exactly what's failing:

```powershell
npx supabase@latest functions logs whatsapp-webhook
```

**Look for:**
- ✅ "Received webhook" = Webhook is getting messages
- ✅ "Message stored successfully" = It's working!
- ❌ "Error storing message in database" = See the error details

---

## Step 2: Check if Table Exists

Run in Supabase SQL Editor:

```sql
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'whatsapp_messages'
);
```

**If `false`:**
- Table doesn't exist!
- Run: `docs/database-schema-whatsapp-messages.sql` to create it

---

## Step 3: Check RLS is Disabled

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'whatsapp_messages';
```

**If `rowsecurity = true`:**
- RLS is blocking inserts!
- Disable it:
  ```sql
  ALTER TABLE public.whatsapp_messages DISABLE ROW LEVEL SECURITY;
  ```

---

## Step 4: Test Manual Insert

Try inserting a test message:

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

## Most Common Issues:

1. ❌ **Table doesn't exist** → Create it
2. ❌ **RLS enabled** → Disable it  
3. ❌ **Webhook not receiving messages** → Check Twilio webhook URL
4. ❌ **Database insert failing** → Check webhook logs for error

---

## Quick Action Plan:

1. **Run webhook logs** → See what error appears
2. **Check table exists** → Create if missing
3. **Disable RLS** → Run SQL command
4. **Test again** → Send a message from customer

---

**Tell me what the webhook logs show** - that will tell us exactly what's wrong!



