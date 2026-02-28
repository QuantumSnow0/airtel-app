# Fix Error 63024: Invalid Message Recipient

## The Error

Twilio Error **63024** = "Invalid message recipient"

This means the phone number format is wrong or the recipient isn't allowed.

---

## Most Common Causes

### 1. **Using WhatsApp Sandbox - Recipient Not Joined** ⚠️

**This is probably the issue!**

If you're using **WhatsApp Sandbox** (test mode), the recipient **MUST join your sandbox first** before you can send messages to them.

**How to fix:**
1. Go to [Twilio Console](https://console.twilio.com)
2. **Messaging** → **Settings** → **WhatsApp Sandbox**
3. Find the **"Join" code** (e.g., "join happy-moon-123")
4. Have the recipient send this code to your Twilio WhatsApp number
5. Once they join, you can send messages

**Example:**
- Your Twilio number: `+14155238886` (sandbox)
- Join code: "join happy-moon-123"
- Recipient sends: `join happy-moon-123` to `+14155238886`
- ✅ Now you can send messages to them!

**Solution:** Either:
- Have recipients join your sandbox, OR
- Switch to WhatsApp Business API (production) - no join needed

---

### 2. Phone Number Format Issue

Phone number must be exactly: `+254724832555`

**Check:**
- ✅ Starts with `+`
- ✅ Country code `254`
- ✅ No spaces
- ✅ Correct length (9 digits after country code)

The app should format automatically, but verify the number in database.

---

### 3. Number Doesn't Have WhatsApp

- Verify person has WhatsApp installed
- Check number is correct
- Make sure it's a mobile number (not landline)

---

## Quick Fix Checklist

1. **Check if using WhatsApp Sandbox:**
   - If yes → Recipient must join first!
   - If no → Check number format

2. **Verify phone number format:**
   - Should be: `+254724832555`
   - Check what's stored in database

3. **Test with a known good number:**
   - Use your test number: `+254724832555`
   - Make sure it's joined your sandbox (if using sandbox)

4. **Check Twilio Console:**
   - Monitor → Logs → Messages
   - See exact error details

---

## How to Add Recipient to Sandbox

1. Get join code from Twilio Console
2. Share with recipient
3. Recipient sends code to your Twilio number
4. Wait for confirmation
5. Try sending message again

---

## Need Help?

Tell me:
1. **Are you using WhatsApp Sandbox or Business API?**
2. **Has the recipient joined your sandbox?** (if using sandbox)
3. **What phone number are you sending to?**
4. **What error details do you see in Twilio Console?**

I can help fix it!








