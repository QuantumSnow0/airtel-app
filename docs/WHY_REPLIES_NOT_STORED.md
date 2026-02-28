# Why Customer Replies Aren't Being Stored

## Quick Checks

### 1. Check Webhook Logs (Most Important!)

```powershell
npx supabase@latest functions logs whatsapp-webhook
```

Look for:
- **"Error storing message in database"** - See the exact error
- **"Message stored successfully"** - Confirms it worked
- **"Received webhook"** - Confirms webhook received the message

---

### 2. Check if Table Exists

Run in Supabase SQL Editor:
```sql
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'whatsapp_messages'
);
```

If `false`, **create the table:**
- Run: `docs/database-schema-whatsapp-messages.sql`

---

### 3. Check RLS is Disabled

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'whatsapp_messages';
```

Should show: `rowsecurity = false`

**If enabled, disable it:**
```sql
ALTER TABLE public.whatsapp_messages DISABLE ROW LEVEL SECURITY;
```

---

### 4. Check if Webhook is Receiving Messages

1. Go to **Twilio Console** → **Monitor** → **Logs** → **Webhooks**
2. See if webhook calls are happening
3. Check status codes (200 = success, 500 = error)

---

## Most Likely Issues

1. **Table doesn't exist** - Create it using the SQL file
2. **RLS blocking inserts** - Disable RLS
3. **Webhook not configured correctly** - Check Twilio webhook URL
4. **Database insert failing** - Check function logs for errors

---

## Quick Fix Steps

1. **Check webhook logs** - This will show the exact error
2. **Create table if missing** - Run the SQL script
3. **Disable RLS** - Run the SQL command
4. **Redeploy webhook** (if you fixed errors):
   ```powershell
   npx supabase@latest functions deploy whatsapp-webhook
   ```

---

## Tell Me

1. **What do webhook logs show?** (run the command - most important!)
2. **Does the table exist?** (run the SQL check)
3. **Is RLS disabled?** (run the SQL check)

The webhook logs will tell us exactly what's wrong!








