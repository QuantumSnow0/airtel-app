# WhatsApp Message Troubleshooting Guide

## Your Questions Answered

### ❓ "The message didn't go through"

**Let's troubleshoot step by step:**

1. **What alert did you see?**
   - ✅ "Success" → Message was sent! Check recipient's WhatsApp
   - ❌ "Error" → See error message and check solutions below

2. **Check function logs:**
   ```powershell
   npx supabase@latest functions logs send-whatsapp-message
   ```
   - Look for your message attempt
   - Check for error messages

3. **Check Twilio Console:**
   - Go to [Twilio Console](https://console.twilio.com)
   - Monitor → Logs → Messages
   - See if your message appears there
   - Check status (queued, sent, delivered, failed)

---

### ❓ "If I sent before, can't I go again?"

**YES! You can send multiple times!** ✅

The checkmark (✓) is just visual feedback - it doesn't prevent you from sending again.

**To send again:**
- Just tap the WhatsApp button again
- It will send a new message
- No limit on how many times you can send

**The checkmark shows:**
- ✓ = You successfully sent a message before
- But you can still send again anytime!

---

## Common Issues & Solutions

### Issue 1: "Failed to send WhatsApp message"

**Check these:**

1. **Edge Function deployed?**
   ```powershell
   npx supabase@latest functions list
   ```
   - Should see `send-whatsapp-message`
   - If missing, deploy it:
     ```powershell
     npx supabase@latest functions deploy send-whatsapp-message
     ```

2. **Twilio credentials set?**
   ```powershell
   npx supabase@latest secrets list
   ```
   - Should see: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`
   - If missing, set them:
     ```powershell
     npx supabase@latest secrets set TWILIO_ACCOUNT_SID=your_account_sid
     npx supabase@latest secrets set TWILIO_AUTH_TOKEN=your_auth_token
     npx supabase@latest secrets set TWILIO_WHATSAPP_NUMBER=whatsapp:+254789457580
     ```

3. **Template approved?**
   - Go to Twilio Console → Content Templates
   - Your template status must be **"Approved"** (not "Pending")

### Issue 2: "Template not approved"

**Solution:**
- Wait for template approval from WhatsApp/Meta
- Or use a different approved template
- Check template status in Twilio Console

### Issue 3: "Invalid phone number"

**Solution:**
- Phone number must be: `+254724832555` format
- Check customer's phone number in database
- Make sure it's not empty

### Issue 4: Message sent but not received

**Check:**
1. **Twilio Console** → Monitor → Logs → Messages
   - Status should be "delivered"
   - If "failed", check error details

2. **Recipient's WhatsApp:**
   - Message might take a few seconds
   - Check spam/filtered messages
   - Verify the phone number is correct

3. **Using test numbers?**
   - Make sure recipient number is added to Twilio Sandbox
   - Or use approved WhatsApp Business API numbers

---

## How to Test

### Test 1: Send a Message

1. Open app → Messages tab
2. Find a customer
3. Tap WhatsApp button
4. Confirm sending
5. Wait for alert (Success/Error)

### Test 2: Verify Message Was Sent

**Option A: Check Function Logs**
```powershell
npx supabase@latest functions logs send-whatsapp-message
```

**Option B: Check Twilio Console**
- Twilio Console → Monitor → Logs → Messages
- Find your message
- Check status

**Option C: Check Recipient**
- Message should appear in their WhatsApp
- Usually within 1-5 seconds

### Test 3: Send Again (Multiple Times)

**Yes, you can!**
- Just tap the WhatsApp button again
- It will send a new message
- No restrictions

---

## Debugging Commands

```powershell
# List all functions
npx supabase@latest functions list

# View send message logs
npx supabase@latest functions logs send-whatsapp-message

# View webhook logs (for receiving)
npx supabase@latest functions logs whatsapp-webhook

# List all secrets
npx supabase@latest secrets list

# Deploy send function (if needed)
npx supabase@latest functions deploy send-whatsapp-message
```

---

## Quick Answers

**Q: Can I send multiple times to the same customer?**  
A: **YES!** No limit. Just tap the button again.

**Q: Why is there a checkmark?**  
A: It just shows you sent once. You can still send again!

**Q: Message didn't go through?**  
A: Check the error message, then check function logs and Twilio Console.

**Q: How do I know if message was sent?**  
A: You'll see "Success" alert. Also check Twilio Console → Logs → Messages.

---

## Still Having Issues?

Tell me:
1. **What error message** did you see? (from the alert)
2. **Can you tap the button again?** (does it work or show error?)
3. **Check function logs** - what do you see?
4. **Check Twilio Console** - is the message there?

I can help troubleshoot further!







