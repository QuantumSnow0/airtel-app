# Simple Windows Setup Guide - Using npx (No Installation!)

If you're on Windows and got the error about npm global install not being supported, **use npx instead** - no installation needed!

---

## Quick Setup (Using npx)

Just add `npx supabase@latest` before each command:

### Step 1: Login

```powershell
npx supabase@latest login
```

This will open a browser window for you to authenticate.

### Step 2: Link Your Project

```powershell
npx supabase@latest link --project-ref YOUR_PROJECT_ID
```

Replace `YOUR_PROJECT_ID` with your actual Supabase project ID (found in your dashboard URL).

### Step 3: Create the Webhook Function

```powershell
npx supabase@latest functions new whatsapp-webhook
```

This creates the folder: `supabase/functions/whatsapp-webhook/`

### Step 4: Copy the Code

The code is already in your project at:
- `supabase/functions/whatsapp-webhook/index.ts`

If it doesn't exist, copy it from the guide.

### Step 5: Set Environment Variables (Secrets)

```powershell
npx supabase@latest secrets set SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
npx supabase@latest secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Find your Service Role Key:**
1. Go to Supabase Dashboard
2. Settings > API
3. Copy the `service_role` key (NOT the anon key!)

### Step 6: Deploy the Function

```powershell
npx supabase@latest functions deploy whatsapp-webhook
```

You should see output with the Function URL. **Copy it!**

### Step 7: Configure Twilio

1. Go to [Twilio Console](https://console.twilio.com)
2. Navigate to: **Messaging** > **Settings** > **WhatsApp Sandbox**
3. Set **Status Callback URL** to:
   ```
   https://YOUR_PROJECT_ID.supabase.co/functions/v1/whatsapp-webhook
   ```
4. Set HTTP method to: **POST**
5. Save

---

## All Commands at Once

Copy and paste these (replace `YOUR_PROJECT_ID` and `YOUR_SERVICE_ROLE_KEY`):

```powershell
# 1. Login
npx supabase@latest login

# 2. Link project
npx supabase@latest link --project-ref YOUR_PROJECT_ID

# 3. Create function (if folder doesn't exist)
npx supabase@latest functions new whatsapp-webhook

# 4. Set secrets
npx supabase@latest secrets set SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
npx supabase@latest secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

# 5. Deploy
npx supabase@latest functions deploy whatsapp-webhook
```

---

## That's It!

✅ No installation needed  
✅ Works on Windows  
✅ Uses npx (comes with npm)

Then just configure the webhook URL in Twilio Console!

---

## Need Help?

See the complete guide: [`docs/TWILIO_WEBHOOK_COMPLETE_SETUP.md`](./TWILIO_WEBHOOK_COMPLETE_SETUP.md)








