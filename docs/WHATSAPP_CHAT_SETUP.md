# WhatsApp Chat System - Complete Setup Guide

## Overview

This system allows you to:

1. ✅ **Receive customer text messages** - Handle free-form replies (not just button clicks)
2. ✅ **Store all messages** - Complete conversation history in database
3. ✅ **View conversations** - See all messages with each customer
4. ✅ **Reply to customers** - Send free-form text messages back

---

## Setup Steps

### Step 1: Create Messages Table

Run this SQL in your Supabase SQL Editor:

```sql
-- See: docs/database-schema-whatsapp-messages.sql
```

This creates the `whatsapp_messages` table that stores all messages (sent and received).

---

### Step 2: Set Up Webhook Handler (Complete Guide)

**📖 NEW TO WEBHOOKS?** See the complete setup guide: [`docs/TWILIO_WEBHOOK_COMPLETE_SETUP.md`](./TWILIO_WEBHOOK_COMPLETE_SETUP.md)

This comprehensive guide covers everything from scratch:

- Installing Supabase CLI
- Creating and deploying the Edge Function
- Setting up environment variables
- Configuring Twilio webhooks
- Testing and troubleshooting

**Quick overview:**

The webhook (`supabase/functions/whatsapp-webhook/index.ts`) handles:

- ✅ Button clicks (Yes/No)
- ✅ Text messages (free-form replies)
- ✅ Stores all messages in the database

**To deploy and configure:**

1. Install Supabase CLI: `npm install -g supabase`
2. Login: `supabase login`
3. Link project: `supabase link --project-ref YOUR_PROJECT_ID`
4. Create function: `supabase functions new whatsapp-webhook`
5. Set secrets: `supabase secrets set SUPABASE_URL=...` and `SUPABASE_SERVICE_ROLE_KEY=...`
6. Deploy: `supabase functions deploy whatsapp-webhook`
7. Configure Twilio: Set webhook URL in Twilio Console

**See the complete guide for detailed steps:** [`TWILIO_WEBHOOK_COMPLETE_SETUP.md`](./TWILIO_WEBHOOK_COMPLETE_SETUP.md)

---

### Step 3: Create Text Message Edge Function

Create a new Edge Function to send free-form text messages:

```bash
supabase functions new send-whatsapp-text-message
```

Copy the code from `supabase/functions/send-whatsapp-text-message/index.ts`

**Deploy it:**

```bash
supabase functions deploy send-whatsapp-text-message
```

---

### Step 4: Configure Twilio Webhook

Make sure your Twilio webhook is set to:

```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/whatsapp-webhook
```

This webhook will receive:

- Button clicks (Yes/No)
- Text messages (free-form replies)

---

## How It Works

### When Customer Sends a Message

```
Customer types: "Yes I received it, thank you!"
  ↓
Twilio receives the message
  ↓
Twilio sends webhook to your Edge Function
  ↓
Edge Function stores message in whatsapp_messages table
  ↓
Your app shows the message in real-time
```

### When You Send a Reply

```
Admin types: "Great! Is everything working well?"
  ↓
App calls sendWhatsAppTextMessage()
  ↓
Edge Function sends message via Twilio
  ↓
Message stored in whatsapp_messages table
  ↓
Customer receives message on WhatsApp
```

---

## Viewing Conversations in the App

The **Messages** tab will show:

1. **Customer list** - All customers
2. **Unread indicator** - Customers with new messages
3. **Tap customer** - Opens chat conversation
4. **Chat view** - Shows all messages (sent and received)
5. **Reply box** - Type and send replies

---

## Files Created

1. ✅ `docs/database-schema-whatsapp-messages.sql` - Database schema
2. ✅ `supabase/functions/whatsapp-webhook/index.ts` - Updated webhook (handles text messages)
3. ✅ `supabase/functions/send-whatsapp-text-message/index.ts` - Send text messages
4. ✅ `lib/whatsapp.ts` - Added `sendWhatsAppTextMessage()` function
5. ⏳ `app/(tabs)/messages.tsx` - Will be updated to show conversations (next step)

---

## Next Steps

1. ✅ Database table created
2. ✅ Webhook updated
3. ✅ Text message function created
4. ⏳ Update Messages tab UI to show conversations
5. ⏳ Add chat interface for replying

---

## Testing

1. **Send a test template message** to a customer
2. **Customer replies with text** (not clicking button)
3. **Check database** - message should be in `whatsapp_messages` table
4. **Check app** - message should appear in conversation view

---

## Database Schema

The `whatsapp_messages` table stores:

- `message_body` - The actual message text
- `direction` - 'inbound' (from customer) or 'outbound' (to customer)
- `message_type` - 'text', 'template', 'button_click', or 'media'
- `customer_phone` - Customer's WhatsApp number
- `lead_id` - Links to customer record
- `created_at` - Timestamp
