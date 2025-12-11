# How to Deploy the WhatsApp Webhook Function

You have two options to deploy the updated webhook function:

## Option 1: Deploy via Supabase Dashboard (Recommended - Easier)

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project

2. **Open Edge Functions**
   - Click on "Edge Functions" in the left sidebar
   - Find `whatsapp-webhook` in the list

3. **Update the Function**
   - Click on `whatsapp-webhook` function
   - Click "Edit Function" or "Deploy"
   - Copy the entire contents of `supabase/functions/whatsapp-webhook/index.ts`
   - Paste it into the editor
   - Click "Deploy" or "Save"

4. **Verify Deployment**
   - Check the function logs to ensure it deployed successfully
   - Test by sending a WhatsApp message

## Option 2: Install Supabase CLI and Deploy

### Step 1: Install Supabase CLI

**Windows (PowerShell):**

```powershell
# Using Scoop (if you have it)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Or using npm
npm install -g supabase
```

**Or download directly:**

- Visit: https://github.com/supabase/cli/releases
- Download the Windows executable
- Add it to your PATH

### Step 2: Login to Supabase

```powershell
supabase login
```

### Step 3: Link Your Project

```powershell
# From project root
cd C:\Users\BONFACE\airtel-Router
supabase link --project-ref YOUR_PROJECT_REF
```

To find your project ref:

- Go to Supabase Dashboard → Project Settings → General
- Copy the "Reference ID"

### Step 4: Deploy the Function

```powershell
# From project root
supabase functions deploy whatsapp-webhook
```

## Quick Alternative: Use npx (No Installation Needed)

If you have Node.js installed, you can use npx without installing:

```powershell
# From project root
cd C:\Users\BONFACE\airtel-Router
npx supabase functions deploy whatsapp-webhook
```

This will prompt you to login and link your project if needed.

## Verify Deployment

After deployment, test it:

1. Send a WhatsApp message to your Twilio number
2. Check Supabase Edge Function logs for activity
3. Verify the message is stored in `whatsapp_messages` table
4. Check if auto-reply is sent (for button clicks) or flagged (for complex text)

## Troubleshooting

**"Command not found" error:**

- Use Option 1 (Dashboard) instead
- Or install Supabase CLI first

**"Not linked to project" error:**

- Run `supabase link --project-ref YOUR_PROJECT_REF`
- Or use the Dashboard method

**Function deployment fails:**

- Check that all dependencies are correct
- Verify the function code has no syntax errors
- Check Supabase logs for specific error messages

## Recommended Approach

For simplicity, **use Option 1 (Supabase Dashboard)** - it's the easiest and doesn't require any CLI installation.
