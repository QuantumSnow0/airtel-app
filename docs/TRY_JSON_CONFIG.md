# Try JSON Config Format

## Your Suggestion

You suggested using a nested JSON format:

```json
{
  "functions": {
    "whatsapp-webhook": {
      "verify_jwt": false
    }
  }
}
```

## What I Did

I've created `supabase/config.json` with this exact format.

---

## Now Try Both

You now have **two config files**:

1. **`supabase/config.toml`** (TOML format):

   ```toml
   [functions.whatsapp-webhook]
   verify_jwt = false
   ```

2. **`supabase/config.json`** (JSON format - your suggestion):
   ```json
   {
     "functions": {
       "whatsapp-webhook": {
         "verify_jwt": false
       }
     }
   }
   ```

---

## Redeploy

Redeploy the function:

```powershell
npx supabase@latest functions deploy whatsapp-webhook
```

Supabase should pick up **one of these config files** (probably `config.toml` takes precedence, but let's see).

---

## Test

After redeploying, test with Twilio again. The 401 should be resolved if the config format is correct.

---

## If Still Not Working

If neither config file works, we'll need to:

1. Check Supabase Dashboard for a manual toggle
2. Use service role key in URL as a workaround

Let me know what happens after redeploying!
