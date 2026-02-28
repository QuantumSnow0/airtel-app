# Quick Deploy Commands

## Deploy All Three Edge Functions

### 1. Deploy WhatsApp Webhook (Main Function)

```bash
npx supabase functions deploy whatsapp-webhook
```

### 2. Deploy Check Unanswered Messages (Proactive Checker)

```bash
npx supabase functions deploy check-unanswered-messages
```

### 3. Deploy Package Follow-up (Proactive Checker)

```bash
npx supabase functions deploy followup-package-delivery
```

---

## Deploy All at Once (Run from project root)

```bash
npx supabase functions deploy whatsapp-webhook && npx supabase functions deploy check-unanswered-messages && npx supabase functions deploy followup-package-delivery
```

---

## Prerequisites

Make sure you're:

1. **In the project root directory** (where `supabase` folder is)
2. **Logged in to Supabase CLI:**
   ```bash
   npx supabase login
   ```
3. **Linked to your project:**
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_ID
   ```

---

## Verify Deployment

After deploying, check in Supabase Dashboard → Edge Functions to confirm all three functions are deployed.




