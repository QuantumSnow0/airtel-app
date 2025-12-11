# Webhook URL Format - Fix Validation Error

If you're getting the error: **"URL must follow this schema <http(s)://><domain><path or query>"**

## ✅ Correct URL Format

Use this **exact** URL (copy it exactly, no spaces):

```
https://mcpfqnccbszswlcxpcbq.supabase.co/functions/v1/whatsapp-webhook
```

---

## Common Mistakes to Avoid

❌ **Don't add:**
- Trailing slash at the end
- Extra spaces
- Special characters
- Line breaks

✅ **Must have:**
- `https://` at the start (not `http://`)
- No trailing slash
- All lowercase
- No spaces

---

## Step-by-Step

1. **Clear the field completely** (delete everything)
2. **Copy this exact URL:**
   ```
   https://mcpfqnccbszswlcxpcbq.supabase.co/functions/v1/whatsapp-webhook
   ```
3. **Paste it** into "Webhook URL for incoming messages"
4. **Verify it looks exactly like this:**
   - Starts with `https://`
   - No spaces before or after
   - No trailing slash
   - Ends with `whatsapp-webhook`
5. **Set method to:** `HTTP Post`
6. **Click Save**

---

## If Still Not Working

### Check 1: Copy the URL correctly
The URL should be **exactly**:
```
https://mcpfqnccbszswlcxpcbq.supabase.co/functions/v1/whatsapp-webhook
```

### Check 2: No hidden characters
- Clear the field
- Type it manually or copy from here
- Make sure there are no invisible characters

### Check 3: Verify function is deployed
You can verify your function is accessible by visiting:
```
https://mcpfqnccbszswlcxpcbq.supabase.co/functions/v1/whatsapp-webhook
```
In a browser (it should show an error or "Method not allowed" - that's OK, it means the function exists!)

---

## Quick Copy-Paste

Here's the URL ready to copy (no extra spaces):

```
https://mcpfqnccbszswlcxpcbq.supabase.co/functions/v1/whatsapp-webhook
```

Just select and copy the line above!

