# Complete Twilio Webhook Setup Guide - Step by Step

This guide will walk you through setting up Twilio webhooks from scratch, including deploying the webhook handler and configuring Twilio.

---

## Prerequisites

Before starting, make sure you have:

- ✅ Twilio account set up
- ✅ WhatsApp Business API access (or sandbox)
- ✅ Supabase project created
- ✅ Supabase CLI installed (for deploying Edge Functions)

---

## Part 1: Create and Deploy the Webhook Handler

### Step 1: Install Supabase CLI (if not already installed)

**⚠️ IMPORTANT:** Supabase CLI cannot be installed via `npm install -g` anymore. Use one of these methods:

#### Option A: Using Scoop (Windows - Recommended)

1. **Install Scoop** (if you don't have it):

   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
   ```

2. **Install Supabase CLI**:
   ```powershell
   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   scoop install supabase
   ```

#### Option B: Using npx (No Installation Required - Easiest!)

You can use Supabase CLI via npx without installing globally. Just use `npx supabase@latest` before each command:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref YOUR_PROJECT_ID
npx supabase@latest functions new whatsapp-webhook
npx supabase@latest functions deploy whatsapp-webhook
```

**This is the easiest method if you don't want to install anything!**

#### Option C: Direct Download (Windows)

1. Download the latest release from: https://github.com/supabase/cli/releases
2. Extract the `.exe` file
3. Add it to your system PATH, or use it directly

#### Option D: Homebrew (Mac/Linux)

```bash
brew install supabase/tap/supabase
```

### Step 2: Login to Supabase CLI

```bash
supabase login
```

This will open a browser window for you to authenticate.

### Step 3: Link Your Project

```bash
supabase link --project-ref YOUR_PROJECT_ID
```

Replace `YOUR_PROJECT_ID` with your actual Supabase project ID. You can find it in your Supabase dashboard URL:

- URL format: `https://supabase.com/dashboard/project/YOUR_PROJECT_ID`
- Or in Project Settings > General > Reference ID

### Step 4: Create the Webhook Edge Function

```bash
supabase functions new whatsapp-webhook
```

This creates a new folder: `supabase/functions/whatsapp-webhook/`

### Step 5: Copy the Webhook Code

Copy the code from `supabase/functions/whatsapp-webhook/index.ts` that was already created in your project.

If the file doesn't exist, create it at:

```
supabase/functions/whatsapp-webhook/index.ts
```

The code should handle both button clicks and text messages (the updated version we created).

### Step 6: Set Up Environment Variables (Secrets)

You need to set these secrets in Supabase for the Edge Function to work:

```bash
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**How to find your Service Role Key:**

1. Go to Supabase Dashboard
2. Settings > API
3. Copy the `service_role` key (NOT the anon key!)
4. Keep it secret - never commit it to git!

**Example:**

```bash
supabase secrets set SUPABASE_URL=https://mcpfqnccbszswlcxpcbq.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 7: Deploy the Webhook Function

```bash
supabase functions deploy whatsapp-webhook
```

You should see output like:

```
Deploying function whatsapp-webhook...
Function whatsapp-webhook deployed successfully!
Function URL: https://YOUR_PROJECT_ID.supabase.co/functions/v1/whatsapp-webhook
```

**Copy the Function URL** - you'll need it in Part 2!

---

## Part 2: Configure Twilio Webhook

### Step 1: Go to Twilio Console

1. Login to [Twilio Console](https://console.twilio.com)
2. Navigate to: **Messaging** > **Settings** > **WhatsApp Sandbox**

   OR if you're using WhatsApp Business API (not sandbox):
   - Go to: **Messaging** > **Try it out** > **Send a WhatsApp message**
   - Click on your WhatsApp sender number
   - Go to the **Configuration** tab

### Step 2: Find Webhook Configuration

Look for these fields:

- **Status Callback URL** (or **Webhook URL**)
- **Status Callback Method** (should be `POST`)

### Step 3: Set the Webhook URL

Enter your Supabase Edge Function URL:

```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/whatsapp-webhook
```

Replace `YOUR_PROJECT_ID` with your actual Supabase project ID.

**Example:**

```
https://mcpfqnccbszswlcxpcbq.supabase.co/functions/v1/whatsapp-webhook
```

### Step 4: Set the HTTP Method

Make sure it's set to: **POST**

### Step 5: Save Configuration

Click **Save** or **Update** to save your webhook settings.

---

## Part 3: Test the Webhook

### Step 1: Send a Test Message

Send a WhatsApp message to your Twilio number from a test number.

### Step 2: Check Edge Function Logs

View the logs to see if the webhook was called:

```bash
supabase functions logs whatsapp-webhook
```

Or view in Supabase Dashboard:

1. Go to **Edge Functions** in your Supabase dashboard
2. Click on `whatsapp-webhook`
3. Go to **Logs** tab

### Step 3: Check Database

Check if the message was stored:

```sql
SELECT * FROM whatsapp_messages
ORDER BY created_at DESC
LIMIT 10;
```

---

## Troubleshooting

### Webhook Not Receiving Messages?

1. **Check the URL is correct**
   - Must be: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/whatsapp-webhook`
   - No trailing slash
   - Uses `https://` not `http://`

2. **Check Twilio Webhook is set correctly**
   - Go to Twilio Console > WhatsApp Sandbox Settings
   - Verify the webhook URL matches your Edge Function URL
   - Make sure HTTP method is `POST`

3. **Check Edge Function Logs**

   ```bash
   supabase functions logs whatsapp-webhook
   ```

   - Look for errors
   - See if webhook is being called

4. **Check Twilio Webhook Logs**
   - Go to Twilio Console > Monitor > Logs > Webhooks
   - See if Twilio is trying to call your webhook
   - Check for error responses

### Edge Function Errors?

1. **Check Environment Variables**

   ```bash
   supabase secrets list
   ```

   - Make sure `SUPABASE_URL` is set
   - Make sure `SUPABASE_SERVICE_ROLE_KEY` is set

2. **Check Function Code**
   - Make sure the code in `supabase/functions/whatsapp-webhook/index.ts` is correct
   - Redeploy if you made changes:
     ```bash
     supabase functions deploy whatsapp-webhook
     ```

### Database Not Updating?

1. **Check Database Table Exists**
   - Run the SQL from `docs/database-schema-whatsapp-messages.sql`
   - Make sure the table `whatsapp_messages` exists

2. **Check RLS (Row Level Security)**
   - The Edge Function uses Service Role Key (bypasses RLS)
   - But check if the table allows inserts

3. **Check Function Logs**
   - Look for database errors in the logs

---

## Quick Command Reference

**Using npx (no installation needed):**

```bash
# Login to Supabase
npx supabase@latest login

# Link project
npx supabase@latest link --project-ref YOUR_PROJECT_ID

# Create new function
npx supabase@latest functions new whatsapp-webhook

# Set secrets
npx supabase@latest secrets set SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
npx supabase@latest secrets set SUPABASE_SERVICE_ROLE_KEY=your_key

# Deploy function
npx supabase@latest functions deploy whatsapp-webhook

# View logs
npx supabase@latest functions logs whatsapp-webhook

# List secrets
npx supabase@latest secrets list
```

**Or if you installed CLI globally (via Scoop/Homebrew):**

```bash
# Just use 'supabase' instead of 'npx supabase@latest'
supabase login
supabase link --project-ref YOUR_PROJECT_ID
supabase functions new whatsapp-webhook
# etc...
```

---

## What Happens Next?

Once the webhook is set up:

1. ✅ Customer sends WhatsApp message → Twilio receives it
2. ✅ Twilio calls your webhook → Edge Function processes it
3. ✅ Edge Function stores message → Database updated
4. ✅ Your app shows message → Real-time updates via Supabase

---

## Next Steps

After webhook is working:

1. ✅ Set up database table (see `docs/database-schema-whatsapp-messages.sql`)
2. ✅ Deploy text message function (see `docs/WHATSAPP_CHAT_SETUP.md`)
3. ✅ Update Messages tab UI (to show conversations)

---

## Need Help?

Check these files for more details:

- `docs/WHATSAPP_CHAT_SETUP.md` - Complete chat system setup
- `docs/whatsapp-webhook-setup.md` - Webhook details
- `docs/WHATSAPP_RESPONSES_SETUP.md` - Response handling
