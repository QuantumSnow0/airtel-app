# AI Automation Setup Guide

This guide explains how to set up automated WhatsApp responses using AI.

## Features

- **Button Click Auto-Replies**: Automatically responds to Yes/No button clicks
- **Text Message AI Analysis**: Uses Google Gemini AI to analyze customer messages
- **Smart Flagging**: Complex questions are flagged for agent review
- **2-Minute Delay**: Natural delay before auto-replies to avoid feeling robotic
- **AI Tagging**: All AI responses are clearly tagged

## Setup Steps

### 1. Database Migration

Run the migration SQL to add the necessary fields:

```sql
-- Run this in Supabase SQL Editor
-- File: docs/database-schema-ai-automation.sql
```

This adds:

- `is_ai_response` - Boolean to tag AI-generated messages
- `needs_agent_review` - Boolean to flag messages needing human attention
- `auto_reply_status` - Text field to track auto-reply state

### 2. Configure Google Gemini API

1. Get a free API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Add it as a Supabase Secret:
   - Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets
   - Add secret: `GEMINI_API_KEY` with your API key value

### 3. Deploy Updated Webhook Function

The webhook function has been updated with auto-reply logic. Deploy it:

```bash
# From your project root
cd supabase/functions/whatsapp-webhook
supabase functions deploy whatsapp-webhook
```

Or use the Supabase Dashboard to deploy.

### 4. Verify Twilio Credentials

Ensure these secrets are set in Supabase:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_NUMBER`

## How It Works

### Button Clicks

When a customer clicks a button:

1. Message is stored immediately
2. Auto-reply is sent right away (no delay)
3. Response depends on button:
   - **Yes**: "Thank you for choosing us. We're pleased to know your device has been delivered successfully. Should you need any assistance, feel free to reach out anytime."
   - **No**: "We apologize for that, Airtel is working hard to solve the issue to follow up please reach out to 0733100500"

### Text Messages

When a customer sends a text message:

1. Message is stored immediately
2. Webhook returns success (fast response to Twilio)
3. After 2 minutes, AI analyzes the message:
   - **Simple question** → AI generates and sends appropriate response
   - **Complex question** → Message is flagged for agent review (no auto-reply)
4. AI responses are tagged with "AI" badge

### Smart Logic

- **No auto-reply if**: Agent sent a message in last 2 hours
- **No auto-reply if**: Customer already replied after an auto-reply
- **Flagged messages**: Appear in "Needs Review" filter in Messages tab

## UI Features

### Messages Tab

- **"Needs Review" Filter**: Shows conversations with flagged messages
- **AI Badge**: AI-generated messages show a sparkle icon and "AI" label
- **Review Badge**: Conversations needing review show a flag icon

### Chat View

- AI messages are clearly marked with an "AI" badge
- Flagged messages are highlighted for easy identification

## Customization

### Changing Auto-Reply Messages

Edit the messages in `supabase/functions/whatsapp-webhook/index.ts`:

```typescript
// Button click responses
if (responseValue === "yes_received") {
  replyMessage = "Your custom message here";
}
```

### Adjusting AI Behavior

Modify the AI prompt in the `analyzeMessageWithAI` function to change:

- What's considered "simple" vs "complex"
- Response tone and style
- Language preferences

### Changing Delay Time

Modify the delay in `handleTextMessageAutoReply`:

```typescript
// Change 2 minutes to your preferred delay
await new Promise((resolve) => setTimeout(resolve, 2 * 60 * 1000));
```

## Troubleshooting

### Auto-replies not working?

1. Check Supabase function logs for errors
2. Verify `GEMINI_API_KEY` is set correctly
3. Check Twilio credentials are valid
4. Ensure database migration was run

### AI not responding?

1. Check Google Gemini API key is valid
2. Verify API quota hasn't been exceeded (free tier: 15 req/min)
3. Check function logs for AI errors

### Messages not being flagged?

1. Verify database migration was run
2. Check `needs_agent_review` field exists in `whatsapp_messages` table
3. Review AI analysis logic in webhook function

## Monitoring

- Check Supabase Edge Function logs for auto-reply activity
- Monitor Google Gemini API usage in Google AI Studio
- Review flagged messages in Messages tab → "Needs Review" filter

## Cost Considerations

- **Google Gemini Free Tier**: 15 requests/minute, 1,500 requests/day
- **Beyond free tier**: Pay-as-you-go pricing
- **Recommendation**: Monitor usage and upgrade if needed

## Next Steps

1. Run database migration
2. Set up Google Gemini API key
3. Deploy updated webhook function
4. Test with sample messages
5. Monitor and adjust as needed
