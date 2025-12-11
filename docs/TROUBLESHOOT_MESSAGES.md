# Troubleshooting WhatsApp Messages

## Quick Answers

### ❓ "Message didn't go through?"

**Check these:**

1. **Did you see a "Success" or "Error" alert?**
   - If "Success" → Message was sent, check recipient's WhatsApp
   - If "Error" → See error message below

2. **Check function logs:**

   ```powershell
   npx supabase@latest functions logs send-whatsapp-message
   ```

3. **Check Twilio Console:**
   - Go to Twilio Console → Monitor → Logs → Messages
   - See if message appears there

---

### ❓ "I sent before, can I send again?"

**YES! You can send as many times as you want!**

The checkmark (✓) just shows you sent once. You can:

- ✅ Send the same message again
- ✅ Send to the same customer multiple times
- ✅ Send different messages

**To send again:**

- Just tap the WhatsApp button again
- The app will send a new message
- The checkmark is just visual - it doesn't block sending

---

## Troubleshooting Steps

### Step 1: Check What Error You Got

When you tap "Send", you'll see an alert:

- ✅ **"Success"** → Message was sent! Check recipient's WhatsApp
- ❌ **"Error"** → Note the error message and see solutions below

### Step 2: Common Errors & Solutions

#### Error: "Failed to send WhatsApp message"

**Check:**

- Edge Function deployed? (`send-whatsapp-message`)
- Twilio credentials set?
- Template approved in Twilio?

#### Error: "Template not approved"

**Solution:**

- Go to Twilio Console → Content Templates
- Wait for template to be "Approved"
- Or use a different approved template

#### Error: "Invalid phone number"

**Solution:**

- Phone number must be in format: `+254...`
- Check the customer's phone number in database

#### Error: "Edge Function not found"

**Solution:**

- Deploy the function:
  ```powershell
  npx supabase@latest functions deploy send-whatsapp-message
  ```

---

### Step 3: Verify Message Was Sent

**Option A: Check Twilio Console**

1. Go to [Twilio Console](https://console.twilio.com)
2. **Monitor** → **Logs** → **Messages**
3. Find your message
4. Check status:
   - **Queued** = Sending
   - **Sent** = Delivered to WhatsApp
   - **Delivered** = Customer received
   - **Failed** = Error occurred

**Option B: Check Function Logs**

```powershell
npx supabase@latest functions logs send-whatsapp-message
```

**Option C: Check Recipient's WhatsApp**

- Message should appear in their WhatsApp
- Might take a few seconds

---

### Step 4: Can't Send Again?

**The checkmark doesn't prevent sending!** To send again:

1. **Option 1:** Just tap the WhatsApp button again
   - The app will send a new message
   - Checkmark is just visual

2. **Option 2:** Refresh the app
   - Close and reopen
   - Checkmark will reset

3. **Option 3:** If stuck, check:
   - Is the button disabled? (shouldn't be after sending)
   - Any error messages?
   - Check app console for errors

---

## Testing Checklist

- [ ] Can you see customers in Messages tab?
- [ ] Does the WhatsApp button appear?
- [ ] When you tap, does confirmation dialog appear?
- [ ] After confirming, do you see "Success" or "Error"?
- [ ] If "Success", check recipient's WhatsApp
- [ ] If "Error", note the error message

---

## Quick Debug Commands

```powershell
# Check if functions are deployed
npx supabase@latest functions list

# View send message logs
npx supabase@latest functions logs send-whatsapp-message

# View webhook logs (for receiving)
npx supabase@latest functions logs whatsapp-webhook

# Check secrets (Twilio credentials)
npx supabase@latest secrets list
```

---

## Need More Help?

1. **What error message did you see?** (from the alert)
2. **Check function logs** - Most errors show up here
3. **Check Twilio Console** - See message status
4. **What happens when you tap the button again?** - Does it send or show an error?

Tell me what you see and I can help troubleshoot further!
