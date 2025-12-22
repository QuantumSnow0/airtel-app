# Troubleshooting: Messages Not Going Through

## Two Questions Answered

### ❓ Question 1: "The message didn't go through"

**Possible reasons:**
1. Edge Function not deployed
2. Twilio credentials not set
3. Template not approved
4. Wrong phone number format

### ❓ Question 2: "If I sent before, can't I send again?"

**YES! You can send multiple times!** ✅

The checkmark (✓) is just visual feedback. You can:
- Tap the button again to send
- Send as many times as you want
- No restrictions

---

## Troubleshooting Steps

### Step 1: Check Edge Function is Deployed

The app needs the `send-whatsapp-message` function to send template messages.

**Check if it exists:**
```powershell
npx supabase@latest functions list
```

**If missing, create and deploy it:**
```powershell
# Create function
npx supabase@latest functions new send-whatsapp-message

# Copy code from: supabase/functions/send-whatsapp-message/index.ts

# Deploy it
npx supabase@latest functions deploy send-whatsapp-message
```

### Step 2: Check Twilio Credentials

The function needs Twilio secrets:

```powershell
npx supabase@latest secrets list
```

Should show:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_NUMBER`

**If missing, set them:**
```powershell
npx supabase@latest secrets set TWILIO_ACCOUNT_SID=your_account_sid
npx supabase@latest secrets set TWILIO_AUTH_TOKEN=your_auth_token
npx supabase@latest secrets set TWILIO_WHATSAPP_NUMBER=whatsapp:+254789457580
```

### Step 3: Check Function Logs

```powershell
npx supabase@latest functions logs send-whatsapp-message
```

Look for:
- Your message attempt
- Error messages
- Twilio API responses

### Step 4: Check Twilio Console

1. Go to [Twilio Console](https://console.twilio.com)
2. **Monitor** → **Logs** → **Messages**
3. See if your message appears
4. Check status (queued, sent, delivered, failed)

---

## Common Errors

### "Edge Function not found"
**Fix:** Deploy the function (see Step 1 above)

### "Twilio credentials not configured"
**Fix:** Set Twilio secrets (see Step 2 above)

### "Template not approved"
**Fix:** Wait for template approval or use approved template

### "Invalid phone number"
**Fix:** Must be in `+254...` format

---

## Quick Fix Checklist

- [ ] Create `send-whatsapp-message` Edge Function
- [ ] Deploy the function
- [ ] Set Twilio secrets (Account SID, Auth Token, WhatsApp Number)
- [ ] Check template is approved
- [ ] Test sending a message
- [ ] Check logs if it fails

---

## You Can Send Multiple Times!

**Yes!** The checkmark doesn't prevent sending. Just:
- Tap the WhatsApp button again
- It will send a new message
- No limits!

The checkmark just shows you sent before - it's visual feedback only.

---

## Need More Help?

Tell me:
1. What error message do you see? (from the alert)
2. What's in the function logs?
3. Does the function exist? (check with `functions list`)

I can help fix it!







