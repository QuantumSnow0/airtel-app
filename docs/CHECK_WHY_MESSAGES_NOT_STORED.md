# Why Messages Aren't Being Stored

## The Problem

You sent a message, but nothing appears in `whatsapp_messages` table.

## Possible Causes

### 1. **Database Table Doesn't Exist** ⚠️

The `whatsapp_messages` table might not be created yet!

**Check:**

```sql
SELECT * FROM whatsapp_messages LIMIT 1;
```

If you get an error "relation does not exist", the table needs to be created.

**Fix:** Run the SQL script: `docs/database-schema-whatsapp-messages.sql`

---

### 2. **Row Level Security (RLS) Blocking Inserts** 🔒

If RLS is enabled on `whatsapp_messages` table, Edge Functions might be blocked.

**Check RLS:**

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'whatsapp_messages';
```

**Fix:** Either disable RLS or create a policy that allows Edge Functions to insert.

---

### 3. **Edge Function Insert Failing Silently** 🤫

The code catches database errors but doesn't fail the request, so you might not see the error.

**Check Function Logs:**

```powershell
npx supabase@latest functions logs send-whatsapp-text-message
```

Look for "Error storing message in database" messages.

---

### 4. **Supabase Credentials Not Available** 🔑

Edge Functions need `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to insert.

**Check:** These are automatically provided, but let's verify they're being used correctly.

---

## Quick Fix Steps

### Step 1: Create the Table (if missing)

Run this SQL in Supabase SQL Editor:

```sql
-- Check if table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name = 'whatsapp_messages'
);
```

If it returns `false`, create the table using: `docs/database-schema-whatsapp-messages.sql`

### Step 2: Disable RLS (for now)

```sql
ALTER TABLE public.whatsapp_messages DISABLE ROW LEVEL SECURITY;
```

Or create a policy:

```sql
CREATE POLICY "Allow Edge Functions to insert messages"
ON public.whatsapp_messages
FOR INSERT
WITH CHECK (true);
```

### Step 3: Check Function Logs

```powershell
npx supabase@latest functions logs send-whatsapp-text-message
npx supabase@latest functions logs send-whatsapp-message
```

Look for database errors.

### Step 4: Test Direct Insert

Try inserting a test message directly:

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

If this works, the table is fine. If it fails, check error message.

---

## Most Likely Issue

**The table doesn't exist or RLS is blocking inserts!**

Tell me:

1. **Does the table exist?** (run the SQL check above)
2. **What error do you see in function logs?**
3. **Can you insert a test row manually?**

I can help fix it!
