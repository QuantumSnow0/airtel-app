# How to Find Your Supabase Project ID and Service Role Key

## Finding Your Project ID

### Method 1: From Dashboard URL
1. Open your Supabase Dashboard
2. Look at the URL in your browser
3. It will look like: `https://supabase.com/dashboard/project/abcdefghijklmnop`
4. The `abcdefghijklmnop` part is your **Project ID**

### Method 2: From Project Settings
1. Go to **Project Settings** → **General**
2. Look for **Reference ID** or **Project URL**
3. Your Project ID is the part before `.supabase.co`
   - Example: `https://abcdefghijklmnop.supabase.co` → Project ID is `abcdefghijklmnop`

### Method 3: From Environment Variables
If you have `SUPABASE_URL` set up:
- The URL format is: `https://YOUR_PROJECT_ID.supabase.co`
- Extract the Project ID from there

### Method 4: Check Your Existing Code
Look in your Edge Function environment variables or `.env` file:
- `SUPABASE_URL=https://abcdefghijklmnop.supabase.co` → `abcdefghijklmnop` is your Project ID

---

## Finding Your Service Role Key

### Steps:
1. Go to Supabase Dashboard
2. Navigate to **Project Settings** → **API**
3. Under **Project API keys** section, you'll see:
   - `anon` key (public, safe for client-side)
   - `service_role` key (⚠️ **SECRET** - use this for cron jobs)
4. Click the **eye icon** or **reveal** button to see the `service_role` key
5. Copy the key (it's a long string starting with `eyJ...`)

⚠️ **Security Warning:**
- The `service_role` key has **full database access**
- **Never** expose it in client-side code
- **Never** commit it to Git
- Only use it for server-side operations (like cron jobs, Edge Functions)

---

## Example Cron Setup with Real Values

Once you have both, your SQL should look like this:

```sql
SELECT cron.schedule(
  'check-unanswered-messages',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url:='https://abcdefghijklmnop.supabase.co/functions/v1/check-unanswered-messages',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNTE2MjM5MDIyfQ.YourActualKeyHere"}'::jsonb
  ) AS request_id;
  $$
);
```

(Replace with your actual values!)

---

## Quick Checklist

- [ ] Found Project ID from dashboard URL or settings
- [ ] Found service_role key from API settings
- [ ] Replaced `YOUR_PROJECT_ID` in cron SQL
- [ ] Replaced `YOUR_SERVICE_ROLE_KEY` in cron SQL
- [ ] Verified the URL format is correct

---

## Still Can't Find It?

If you're having trouble:
1. Check your existing Edge Function environment variables
2. Look in your Supabase project's `.env` file (if using local dev)
3. Check your Twilio webhook configuration (might have the Supabase URL there)
4. Contact your team member who set up the Supabase project





