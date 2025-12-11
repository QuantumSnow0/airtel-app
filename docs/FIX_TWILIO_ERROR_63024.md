# Fix Twilio Error 63024: Invalid Message Recipient

## What This Error Means

Error **63024** means Twilio can't send to that phone number. Common reasons:

1. ❌ **Phone number format is wrong**
2. ❌ **Number not added to WhatsApp Sandbox** (if using sandbox)
3. ❌ **Number doesn't have WhatsApp**
4. ❌ **Country code is missing or wrong**

---

## Quick Fixes

### Fix 1: Check Phone Number Format

Phone numbers **must** be in this format: `+254724832555`

**Check:**

- ✅ Starts with `+` (plus sign)
- ✅ Has country code (`254` for Kenya)
- ✅ No spaces or dashes
- ✅ Complete number

**Example:**

- ✅ Correct: `+254724832555`
- ❌ Wrong: `254724832555` (missing +)
- ❌ Wrong: `0724832555` (missing country code)
- ❌ Wrong: `+254 724 832 555` (has spaces)

### Fix 2: Add Number to WhatsApp Sandbox

**If you're using WhatsApp Sandbox** (test mode), you MUST add the recipient number first!

1. Go to [Twilio Console](https://console.twilio.com)
2. **Messaging** → **Settings** → **WhatsApp Sandbox**
3. Find the **"Join" code** (e.g., "join abc-xyz")
4. Have the recipient send this code to your Twilio WhatsApp number
5. Once joined, you can send messages to them

**Or:** Use WhatsApp Business API (production) - no need to join sandbox.

### Fix 3: Verify Number Has WhatsApp

- The number must be a WhatsApp account
- Check if the person has WhatsApp installed
- Verify the number is correct

---

## Debugging Steps

### Step 1: Check What Number You're Sending To

Add logging to see the exact number being sent:

```typescript
console.log("Sending to:", formattedPhone);
console.log("Original number:", phoneNumber);
```

### Step 2: Check Function Logs

```powershell
npx supabase@latest functions logs send-whatsapp-message
```

Look for:

- The phone number being sent
- Any formatting issues
- Error details

### Step 3: Test with Known Good Number

Try sending to a number you know works:

- Your test number: `+254724832555`
- Make sure it's added to WhatsApp Sandbox (if using sandbox)

---

## Common Issues

### Issue 1: Database Has Wrong Format

Phone numbers in database might be:

- `0724832555` (missing country code)
- `254724832555` (missing +)
- `724832555` (incomplete)

**Solution:** Update phone numbers in database to `+254724832555` format.

### Issue 2: Using Sandbox Without Joining

If using WhatsApp Sandbox:

- Recipient must send "join [code]" to your Twilio number first
- Or use WhatsApp Business API for production

### Issue 3: Format Function Not Working

The `formatWhatsAppNumber()` function should convert:

- `0724832555` → `+254724832555`
- `254724832555` → `+254724832555`

Check if it's working correctly.

---

## Quick Test

1. **Use your test number:**
   - Send to: `+254724832555`
   - Make sure it's added to sandbox first

2. **Check the format:**
   - Open customer details
   - See what phone number is stored
   - Verify it's in `+254...` format

3. **Check Twilio Console:**
   - Monitor → Logs → Messages
   - See the exact error details

---

## Need More Info?

Tell me:

1. **What phone number** are you trying to send to?
2. **What format** is it in the database?
3. **Are you using WhatsApp Sandbox** or Business API?
4. **Is the number added** to your sandbox?

I can help fix the formatting!
