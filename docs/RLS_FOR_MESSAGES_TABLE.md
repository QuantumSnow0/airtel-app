# RLS for WhatsApp Messages Table

## Answer: **NO, Don't Enable RLS**

**Disable Row Level Security** for the `whatsapp_messages` table.

## Why?

1. **Edge Functions need to insert messages** - They use SERVICE_ROLE_KEY which bypasses RLS, but it's simpler to just disable it
2. **This is an internal log table** - Only your Edge Functions write to it
3. **Prevents blocking issues** - If RLS is enabled without proper policies, inserts will fail

---

## How to Disable RLS

Run this SQL in Supabase SQL Editor:

```sql
ALTER TABLE public.whatsapp_messages DISABLE ROW LEVEL SECURITY;
```

---

## Verify RLS is Disabled

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'whatsapp_messages';
```

Should show: `rowsecurity = false`

---

## If You Must Enable RLS (Not Recommended)

Only if you really need it, create policies:

```sql
-- Allow Edge Functions to insert
CREATE POLICY "Allow Edge Functions to insert messages"
ON public.whatsapp_messages
FOR INSERT
WITH CHECK (true);

-- Allow reading messages (if needed by your app)
CREATE POLICY "Allow reading messages"
ON public.whatsapp_messages
FOR SELECT
USING (true);
```

**But it's easier to just disable RLS for this table!**

---

## Summary

- ❌ **Don't enable RLS** - It will cause problems
- ✅ **Disable RLS** - Run the SQL above
- ✅ **Keep it simple** - This is an internal table, not user-facing data








