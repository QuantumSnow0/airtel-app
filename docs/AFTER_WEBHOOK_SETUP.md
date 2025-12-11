# Next Steps After Webhook Configuration ✅

Great! Your webhook is configured. Here's what to do next:

---

## Step 1: Create Database Tables

Before the webhook can store messages, you need to create the database tables.

### A. Create WhatsApp Messages Table

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy and paste the SQL from: `docs/database-schema-whatsapp-messages.sql`
3. Click **Run** to execute

This creates the `whatsapp_messages` table that stores all messages.

### B. Add Response Columns to Leads Table

1. In the same **SQL Editor**, run this SQL:

```sql
-- Add columns to store WhatsApp responses in leads table
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS whatsapp_response TEXT NULL,
ADD COLUMN IF NOT EXISTS whatsapp_response_date TIMESTAMP WITH TIME ZONE NULL,
ADD COLUMN IF NOT EXISTS whatsapp_message_sent_date TIMESTAMP WITH TIME ZONE NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_response
ON public.leads(whatsapp_response)
WHERE whatsapp_response IS NOT NULL;
```

Or use the file: `docs/database-schema-whatsapp-responses.sql`

---

## Step 2: Test the Webhook

### Test 1: Send a Test Message

1. Send a test WhatsApp message from your app (Messages tab)
2. Have someone reply with text or click a button
3. Check if the webhook received it

### Test 2: Check Function Logs

```powershell
npx supabase@latest functions logs whatsapp-webhook
```

Look for:

- "Received webhook" messages
- Any errors
- Message processing logs

### Test 3: Check Database

In Supabase SQL Editor, run:

```sql
-- Check if messages are being stored
SELECT * FROM whatsapp_messages ORDER BY created_at DESC LIMIT 5;

-- Check if responses are being recorded
SELECT
  customer_name,
  whatsapp_response,
  whatsapp_response_date
FROM public.leads
WHERE whatsapp_response IS NOT NULL
ORDER BY whatsapp_response_date DESC;
```

---

## Step 3: Update Messages Tab UI (Optional)

The Messages tab currently shows a customer list. You can update it to:

- Show conversations with customers
- Display message history
- Allow sending replies

This is optional - the webhook will work even without UI updates!

---

## Step 4: Deploy Text Message Function (Optional)

If you want to send free-form text messages (not just templates):

1. Create the function:

   ```powershell
   npx supabase@latest functions new send-whatsapp-text-message
   ```

2. Copy code from: `supabase/functions/send-whatsapp-text-message/index.ts`

3. Deploy it:
   ```powershell
   npx supabase@latest functions deploy send-whatsapp-text-message
   ```

---

## Quick Checklist

- [x] Webhook function deployed ✅
- [x] Twilio webhook configured ✅
- [ ] Create `whatsapp_messages` table
- [ ] Add response columns to `leads` table
- [ ] Test webhook with a message
- [ ] Check function logs
- [ ] Verify messages in database

---

## What Works Now

Once database tables are created:

✅ **Button clicks** → Stored in `leads.whatsapp_response`  
✅ **Text messages** → Stored in `whatsapp_messages` table  
✅ **All messages** → Full conversation history  
✅ **Real-time updates** → Your app can show them via Supabase Realtime

---

## Need Help?

- **Function logs:** `npx supabase@latest functions logs whatsapp-webhook`
- **View function:** Supabase Dashboard > Edge Functions > whatsapp-webhook
- **Check database:** Supabase Dashboard > Table Editor
