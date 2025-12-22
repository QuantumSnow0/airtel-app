# Troubleshoot: WhatsApp Text Message Sending Error

## The Error

"failed to send whatsapp text message"

## Possible Causes

1. **Edge Function Not Deployed**
   - The `send-whatsapp-text-message` function might not be deployed to Supabase
   
2. **Twilio Credentials Missing**
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, or `TWILIO_WHATSAPP_NUMBER` not set as Supabase secrets

3. **Phone Number Format Issue**
   - The phone number might not be in the correct format for Twilio

4. **Twilio API Error**
   - Twilio might be rejecting the request (e.g., recipient not in WhatsApp Sandbox)

## How to Fix

### Step 1: Check if Edge Function is Deployed

```powershell
npx supabase@latest functions list
```

Look for `send-whatsapp-text-message` in the list.

If it's **NOT** in the list, deploy it:

```powershell
npx supabase@latest functions deploy send-whatsapp-text-message
```

### Step 2: Verify Twilio Secrets

Check if Twilio secrets are set:

```powershell
npx supabase@latest secrets list
```

You should see:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_NUMBER`

If any are missing, set them:

```powershell
npx supabase@latest secrets set TWILIO_ACCOUNT_SID=your_account_sid
npx supabase@latest secrets set TWILIO_AUTH_TOKEN=your_auth_token
npx supabase@latest secrets set TWILIO_WHATSAPP_NUMBER=whatsapp:+254789457580
```

### Step 3: Check Edge Function Logs

View the function logs to see the actual error:

1. Go to **Supabase Dashboard** → **Edge Functions** → **send-whatsapp-text-message**
2. Click **Logs** tab
3. Try sending a message again
4. Check the logs for error details

### Step 4: Test Phone Number Format

The phone number should be formatted as `+254724832555` (with country code).

Check the console logs in your app - I've added logging that will show:
- The phone number being sent
- The result from the Edge Function

### Step 5: Verify Twilio WhatsApp Number

Make sure `TWILIO_WHATSAPP_NUMBER` is set to your current WhatsApp sender number:

```
whatsapp:+254789457580
```

## Common Twilio Errors

- **Error 63024**: "Invalid message recipient" - Recipient not in WhatsApp Sandbox
- **Error 21211**: "Invalid 'To' Phone Number" - Phone number format is wrong
- **Error 21608**: "The number provided is not a valid WhatsApp-enabled number"

## Next Steps

1. **Check the improved error message** - The app now shows more details about the error
2. **Check console logs** - Look for "Sending WhatsApp text message" and "WhatsApp text message result" logs
3. **Check Supabase Edge Function logs** - This will show the actual Twilio error

Let me know what error details you see!







