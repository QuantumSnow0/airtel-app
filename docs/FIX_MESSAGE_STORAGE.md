# Fix: Messages Not Being Stored

## The Problem

You sent a message, but it's not appearing in the `whatsapp_messages` table.

## Most Likely Issues

### 1. Table Doesn't Exist ⚠️ (Most Common)

**Check:**
```sql
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'whatsapp_messages'
);
```

If `false`, **create the table:**

Run this SQL in Supabase SQL Editor:
```sql
-- See full SQL in: docs/database-schema-whatsapp-messages.sql
```

Or copy from: `docs/database-schema-whatsapp-messages.sql`

---

### 2. Row Level Security (RLS) Blocking Inserts 🔒

**Check RLS:**
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'whatsapp_messages';
```

**If RLS is enabled, disable it:**
```sql
ALTER TABLE public.whatsapp_messages DISABLE ROW LEVEL SECURITY;
```

**Or create a policy:**
```sql
CREATE POLICY "Allow Edge Functions to insert messages"
ON public.whatsapp_messages
FOR INSERT
WITH CHECK (true);
```

---

### 3. Check Function Logs

The functions now log detailed errors. Check:

```powershell
npx supabase@latest functions logs send-whatsapp-text-message
npx supabase@latest functions logs send-whatsapp-message
```

Look for:
- "Error storing message in database"
- "Message stored successfully"
- Database error details

---

## Quick Fix Steps

### Step 1: Create Table (if missing)

1. Open Supabase Dashboard → SQL Editor
2. Run: `docs/database-schema-whatsapp-messages.sql`
3. Check if table was created

### Step 2: Disable RLS (for testing)

```sql
ALTER TABLE public.whatsapp_messages DISABLE ROW LEVEL SECURITY;
```

### Step 3: Test Manual Insert

```sql
INSERT INTO public.whatsapp_messages (
  customer_phone,
  message_body,
  message_type,
  direction,
  status
) VALUES (
  '+254724832555',
  'Test message',
  'text',
  'outbound',
  'sent'
);
```

If this works → Table is fine!
If this fails → Check the error message.

### Step 4: Redeploy Functions

After fixing table/RLS, redeploy:

```powershell
npx supabase@latest functions deploy send-whatsapp-text-message
npx supabase@latest functions deploy send-whatsapp-message
```

### Step 5: Test Again

Send a message and check:
1. Function logs for errors
2. Database table for new row

---

## Still Not Working?

Tell me:
1. **Does table exist?** (run the SQL check)
2. **What error in function logs?**
3. **Can you insert manually?** (test insert SQL)

I can help debug further!



