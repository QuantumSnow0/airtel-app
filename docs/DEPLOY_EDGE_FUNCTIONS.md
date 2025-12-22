# How to Deploy Edge Functions for Proactive Checkers

The Edge Functions are already created in your codebase! You just need to deploy them.

## Option 1: Deploy via Supabase CLI (Recommended)

### Quick Deploy Commands (Using npx - No installation needed):

**From project root, run these commands:**

1. **Deploy WhatsApp Webhook (Main Function):**

   ```bash
   npx supabase functions deploy whatsapp-webhook
   ```

2. **Deploy Check Unanswered Messages:**

   ```bash
   npx supabase functions deploy check-unanswered-messages
   ```

3. **Deploy Package Follow-up:**
   ```bash
   npx supabase functions deploy followup-package-delivery
   ```

**Or deploy all three at once:**

```bash
npx supabase functions deploy whatsapp-webhook && npx supabase functions deploy check-unanswered-messages && npx supabase functions deploy followup-package-delivery
```

### Prerequisites (First time only):

1. **Login to Supabase CLI:**

   ```bash
   npx supabase login
   ```

2. **Link to your project:**
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_ID
   ```

(Replace `YOUR_PROJECT_ID` with your actual Supabase project reference ID)

---

## Option 2: Deploy via Supabase Dashboard

1. **Go to Supabase Dashboard** → **Edge Functions**

2. **Create New Function: `check-unanswered-messages`**
   - Click "Create a new function"
   - Name: `check-unanswered-messages`
   - Copy the contents from `supabase/functions/check-unanswered-messages/index.ts`
   - Paste into the code editor
   - Click "Deploy"

3. **Create New Function: `followup-package-delivery`**
   - Click "Create a new function"
   - Name: `followup-package-delivery`
   - Copy the contents from `supabase/functions/followup-package-delivery/index.ts`
   - Paste into the code editor
   - Click "Deploy"

---

## Verify Deployment

After deploying, test them:

### Test check-unanswered-messages:

```bash
curl -X POST "https://YOUR_PROJECT_ID.supabase.co/functions/v1/check-unanswered-messages" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jcGZxbmNjYnN6c3dsY3hwY2JxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzczODc2NCwiZXhwIjoyMDc5MzE0NzY0fQ.d0PfyjR42EZAJ44psXswtAq3c3FovzGAhzJB_28161Y" \
  -H "Content-Type: application/json"
```

### Test followup-package-delivery:

```bash
curl -X POST "https://YOUR_PROJECT_ID.supabase.co/functions/v1/followup-package-delivery" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Proactive checker triggered",
  "webhookResponse": {
    "success": true,
    "message": "Proactive checker for unanswered messages started"
  }
}
```

---

## After Deployment

Once deployed, you can:

1. **Test manually** using the URLs above
2. **Set up cron jobs** to call them automatically (see `docs/setup-proactive-checkers.sql`)

---

## Troubleshooting

**Function not found?**

- Make sure you deployed to the correct project
- Check function name matches exactly (case-sensitive)

**Authorization error?**

- Use your `service_role` key, not `anon` key
- Get it from: Dashboard → Project Settings → API

**Function exists but not working?**

- Check Edge Function logs in Dashboard
- Verify the webhook function is deployed and working
- Make sure environment variables are set
