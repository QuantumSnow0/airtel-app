# Debug: Why Messages Aren't Being Stored

## Quick Checks

### 1. Check if Table Exists

Run in Supabase SQL Editor:
```sql
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'whatsapp_messages'
);
```

If `false`, create the table using: `docs/database-schema-whatsapp-messages.sql`

---

### 2. Check Function Logs

```powershell
npx supabase@latest functions logs send-whatsapp-text-message
```

Look for:
- "Error storing message in database"
- "Message stored successfully"
- Database errors

---

### 3. Check RLS (Row Level Security)

If RLS is enabled, it might block inserts:

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'whatsapp_messages';

-- Disable RLS (for testing)
ALTER TABLE public.whatsapp_messages DISABLE ROW LEVEL SECURITY;
```

---

### 4. Test Manual Insert

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
  'Test message',
  'text',
  'outbound',
  'sent'
);
```

If this works, table is fine. If not, check error.

---

## Most Common Issues

1. **Table doesn't exist** - Create it
2. **RLS blocking inserts** - Disable or create policy
3. **Wrong phone number format** - Must match database format
4. **Missing lead_id** - Not required, but helps link messages

---

## Tell Me

1. Does the table exist? (run check above)
2. What do function logs show?
3. Can you insert a test row manually?



