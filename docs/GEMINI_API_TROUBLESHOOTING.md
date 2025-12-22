# Gemini API Troubleshooting

## Current Configuration

The function is now using:
- API Version: `v1` (instead of `v1beta`)
- Model: `gemini-pro`

## If You Still Get 404 Errors

Try these alternative model names in the code:

### Option 1: Use v1beta with different model
```typescript
const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiApiKey}`;
```

### Option 2: Use v1 with gemini-1.5-pro
```typescript
const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${geminiApiKey}`;
```

### Option 3: Check Available Models

You can list available models by calling:
```bash
curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_API_KEY"
```

Or visit: https://ai.google.dev/api/rest

## Verify Your API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Make sure your API key is active
3. Check if there are any restrictions on the key
4. Verify the key has access to Gemini API

## Alternative: Use OpenAI Instead

If Gemini continues to have issues, we can switch to OpenAI:

1. Get OpenAI API key from https://platform.openai.com/api-keys
2. Add as `OPENAI_API_KEY` in Supabase Secrets
3. Update the function to use OpenAI instead

Let me know if you want me to implement OpenAI as an alternative!





