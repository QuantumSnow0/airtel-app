# Fix Twilio Error 63024: Invalid Message Recipient

## What This Error Means

Error **63024** = Twilio can't send to that phone number because:
- Phone number format is wrong
- Number not allowed (not in WhatsApp Sandbox if using sandbox)
- Number doesn't have WhatsApp

---

## Common Causes & Fixes

### Cause 1: Phone Number Format Wrong

**Required format:** `+254724832555`

**Check your database:**
- Numbers might be stored as: `0724832555` or `254724832555`
- Need to convert to: `+254724832555`

**Solution:** The app already formats numbers, but check:
1. What format are numbers in your database?
2. The formatting function should convert them automatically

### Cause 2: Using WhatsApp Sandbox (Most Common!)

**If using WhatsApp Sandbox**, the recipient MUST join first!

**How to fix:**
1. Go to Twilio Console → WhatsApp Sandbox
2. Find the **"Join" code** (e.g., "join abc-xyz-123")
3. Have the recipient send this code to your Twilio WhatsApp number
4. Once they join, you can send messages

**Example:**
- Your Twilio number: `+14155238886` (sandbox)
- Join code: "join happy-moon"
- Recipient sends: `join happy-moon` to `+14155238886`
- Then you can send messages to them

### Cause 3: Number Doesn't Have WhatsApp

- Verify the person has WhatsApp
- Check the number is correct
- Make sure WhatsApp is installed on their phone

---

## Quick Fix Steps

### Step 1: Check Phone Number Format

The app should format automatically, but verify:

**In database, numbers should be:**
- ✅ `0724832555` (local format - will be converted)
- ✅ `254724832555` (country code - will add +)
- ✅ `+254724832555` (already correct)

**The formatting function converts:**
- `0724832555` → `+254724832555`
- `254724832555` → `+254724832555`

### Step 2: If Using WhatsApp Sandbox

**Recipient must join first!**

1. Get join code from Twilio Console
2. Recipient sends code to your Twilio number
3. Then you can send messages

**Or:** Use WhatsApp Business API (production) - no join needed.

### Step 3: Test with Known Good Number

Test with a number you know:
- Is in correct format
- Has joined your sandbox (if using sandbox)
- Has WhatsApp

---

## Debugging

### Check Function Logs

```powershell
npx supabase@latest functions logs send-whatsapp-message
```

Look for:
- The phone number being sent
- Error details from Twilio

### Check Twilio Console

1. Go to Twilio Console
2. Monitor → Logs → Messages
3. Find your failed message
4. Click to see error details

---

## Most Likely Issue: WhatsApp Sandbox

**If you're using WhatsApp Sandbox**, this is probably the issue!

**Solution:**
1. Recipient must join your sandbox first
2. Or switch to WhatsApp Business API (production)

---

## Need More Help?

Tell me:
1. **What phone number** are you sending to?
2. **Are you using WhatsApp Sandbox** or Business API?
3. **Has the recipient joined** your sandbox? (if using sandbox)

I can help fix it!







