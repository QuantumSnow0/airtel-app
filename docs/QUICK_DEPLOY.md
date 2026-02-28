# Quick Deploy Guide - Proactive Checker Functions

## Fastest Way: Supabase Dashboard

1. **Open Supabase Dashboard** → **Edge Functions**

2. **Create `check-unanswered-messages`:**
   - Click **"+ Create a new function"**
   - Name: `check-unanswered-messages`
   - Copy ALL code from: `supabase/functions/check-unanswered-messages/index.ts`
   - Paste into editor
   - Click **"Deploy"**

3. **Create `followup-package-delivery`:**
   - Click **"+ Create a new function"**
   - Name: `followup-package-delivery`
   - Copy ALL code from: `supabase/functions/followup-package-delivery/index.ts`
   - Paste into editor
   - Click **"Deploy"**

**Done!** The functions are now deployed and ready to use.

---

## Test After Deployment

Call these URLs to test:

1. **Unanswered Messages Checker:**
   ```
   https://YOUR_PROJECT_ID.supabase.co/functions/v1/check-unanswered-messages
   ```

2. **Package Follow-up:**
   ```
   https://YOUR_PROJECT_ID.supabase.co/functions/v1/followup-package-delivery
   ```

(Use Postman or add Authorization header)

---

## Next: Set Up Cron Jobs

Once deployed, set up cron jobs using `docs/setup-proactive-checkers.sql` to run them automatically!





