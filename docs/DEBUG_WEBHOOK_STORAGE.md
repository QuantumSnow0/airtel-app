# Debug: Customer Replies Not Being Stored

## The Problem

Customer replies are being received by the webhook, but nothing is saved in `whatsapp_messages` table.

## What to Check

### 1. Check Webhook Logs

```powershell
npx supabase@latest functions logs whatsapp-webhook
```

Look for:
- "Error storing message in database" - See the error details
- "Message stored successfully" - Confirms it worked
- "Received webhook" - Confirms webhook is receiving messages

---

### 2. Check if Table Exists

```sql
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'whatsapp_messages'
);
```

If `false`, create the table using: `docs/database-schema-whatsapp-messages.sql`

---

### 3. Check RLS is Disabled

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'whatsapp_messages';
```

Should show: `rowsecurity = false`

If enabled, disable it:
```sql
ALTER TABLE public.whatsapp_messages DISABLE ROW LEVEL SECURITY;
```

---

### 4. Check Supabase Credentials in Webhook

The webhook needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. These are automatically provided, but check logs for:
- "Supabase configuration missing"
- Database connection errors

---

### 5. Test Webhook Directly

Check if webhook is receiving messages:

1. Go to Twilio Console → Monitor → Logs → Webhooks
2. Find recent webhook calls
3. See if they're returning 200 (success) or errors

---

## Most Likely Issues

1. **Table doesn't exist** - Create it
2. **RLS blocking inserts** - Disable RLS
3. **Database insert failing** - Check function logs for error details
4. **Webhook not receiving messages** - Check Twilio webhook configuration

---

## Quick Fix Checklist

- [ ] Table exists? (run SQL check)
- [ ] RLS disabled? (run SQL check and disable if needed)
- [ ] Webhook receiving messages? (check Twilio Console)
- [ ] Check webhook logs for errors
- [ ] Test manual insert to verify table works

---

## Tell Me

1. **What do webhook logs show?** (run the command above)
2. **Does table exist?** (run SQL check)
3. **Is RLS disabled?** (run SQL check)

I can help debug further!







