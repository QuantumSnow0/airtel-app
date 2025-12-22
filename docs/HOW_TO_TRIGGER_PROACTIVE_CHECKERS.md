# How to Trigger Proactive Checkers

## Quick Answer

**You can trigger the proactive checkers in 3 ways:**

### Method 1: Manual HTTP Request (For Testing)

Just call these URLs in your browser or with a tool like Postman:

1. **Check Unanswered Messages:**
   ```
   POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/whatsapp-webhook?action=check-unanswered
   ```

2. **Package Follow-up:**
   ```
   POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/whatsapp-webhook?action=followup-package
   ```

**Headers needed:**
```
Authorization: Bearer YOUR_SERVICE_ROLE_KEY
Content-Type: application/json
```

### Method 2: Via Separate Edge Functions (For Cron Jobs)

If you deployed the separate Edge Functions (`check-unanswered-messages` and `followup-package-delivery`):

1. **Check Unanswered Messages:**
   ```
   POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/check-unanswered-messages
   ```

2. **Package Follow-up:**
   ```
   POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/followup-package-delivery
   ```

### Method 3: Automatic via Cron (Recommended for Production)

Set up cron jobs using the SQL in `docs/setup-proactive-checkers.sql` - they'll run automatically:
- Unanswered messages: Every 10 minutes
- Package follow-up: Every 12 hours

---

## Step-by-Step: Manual Testing

### 1. Get Your Project ID and Service Role Key

- **Project ID:** From Supabase Dashboard → Project Settings → General
- **Service Role Key:** From Supabase Dashboard → Project Settings → API → `service_role` key

### 2. Test Unanswered Messages Checker

**Using curl (Terminal):**
```bash
curl -X POST "https://YOUR_PROJECT_ID.supabase.co/functions/v1/whatsapp-webhook?action=check-unanswered" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

**Using Browser (GET request also works for testing):**
```
https://YOUR_PROJECT_ID.supabase.co/functions/v1/whatsapp-webhook?action=check-unanswered
```
(Add Authorization header via browser extension or use Postman)

**Expected Response:**
```json
{
  "success": true,
  "message": "Proactive checker for unanswered messages started"
}
```

### 3. Check the Logs

Go to Supabase Dashboard → Edge Functions → Logs → `whatsapp-webhook`

You should see logs like:
```
[Webhook] Proactive checker triggered via action parameter
[Proactive Checker] Starting check for unanswered messages...
[Proactive Checker] Found X potential unanswered messages
```

---

## How It Works

1. You call the webhook URL with `?action=check-unanswered` or `?action=followup-package`
2. The webhook detects the action parameter
3. It triggers the appropriate proactive checker function
4. The function runs in the background and checks the database
5. If it finds unanswered messages or customers to follow up, it sends responses

---

## Timing

- **Unanswered Messages:** Checks messages older than 5 minutes (to avoid responding too quickly)
- **Package Follow-up:** Checks customers who reported "no_not_received" 24-48 hours ago
- **Check Frequency:** Depends on how you trigger it:
  - Manual: When you call it
  - Cron: Every 10 minutes (unanswered) or every 12 hours (package)

---

## Troubleshooting

**Not seeing any logs?**
- Check that you're using the correct Project ID
- Verify your Service Role Key is correct
- Check Edge Function logs in Supabase Dashboard

**No messages being sent?**
- Make sure there are actually unanswered messages (older than 5 minutes)
- Check that messages aren't already replied to
- Verify agent hasn't intervened (AI steps back)
- Check rate limits (20 messages/day per customer)

**Still confused?**
Just call this URL (replace YOUR_PROJECT_ID and YOUR_SERVICE_ROLE_KEY):
```
POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/whatsapp-webhook?action=check-unanswered
Authorization: Bearer YOUR_SERVICE_ROLE_KEY
```

That's it! It will start checking and responding to unanswered messages.




