# Alternative Fix: Use config.toml

## The Problem

The `supabase.functions.config.json` file isn't working even after redeploy.

**Let's try using `config.toml` at the project level instead.**

---

## Solution: Create config.toml

I've created `supabase/config.toml` with:

```toml
[functions.whatsapp-webhook]
verify_jwt = false
```

---

## Step 1: Redeploy the Function

```powershell
npx supabase@latest functions deploy whatsapp-webhook
```

This will use the `config.toml` setting instead of the JSON config.

---

## Step 2: Test

After redeploying, test with Twilio again. The 401 should be resolved.

---

## If Still Not Working

If `config.toml` also doesn't work, we might need to:

1. **Check Supabase Dashboard** for a manual toggle
2. **Use service role key in URL** (less secure, but works)
3. **Handle auth in function code** (check for service role key)

Let me know if this works!







