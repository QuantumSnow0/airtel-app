# Agent Skip Duration - How Long AI Steps Back

## Current Behavior (Updated)

The AI steps back (skips auto-reply) when an agent intervenes, but only for **5 minutes**:

### Agent Skip Logic (5 Minutes)

- **Duration:** Lasts for **5 minutes** after an agent sends a message
- **Logic:**
  1. Checks if there's an agent message (non-AI outbound) within the last 5 minutes
  2. Also checks if the most recent outbound message is from an agent AND was sent within 5 minutes
- **Code Location:** Line ~42-75 in `whatsapp-webhook/index.ts`
- **Log Messages:**
  - "Recent agent message found (within 5 minutes), skipping auto-reply"
  - "Most recent message is from agent (within 5 minutes), AI stepping back"
  - "Most recent agent message is older than 5 minutes, AI can respond"

### When AI Resumes

- **After 5 minutes:** If agent hasn't responded within 5 minutes, AI can respond
- **Flagged messages:** Even if a message is flagged (`needs_agent_review`), if agent hasn't replied within 5 minutes, AI will handle it
- **Customer replies:** If customer sends a new message after agent's message, AI can respond immediately

## Summary

- **Skip duration:** 5 minutes from agent's last message
- **Resumes automatically:** After 5 minutes if agent hasn't responded
- **Flagged messages:** AI handles them if agent hasn't responded within 5 minutes

## Examples

**Scenario 1:** Agent sends message at 10:00 AM

- 10:03 AM: Customer sends message → AI steps back (agent message is recent, < 5 min)
- 10:06 AM: Customer sends message → AI can respond (5 minutes passed)

**Scenario 2:** Message flagged for agent review at 10:00 AM

- 10:03 AM: Still flagged, no agent response → AI steps back (waiting for agent)
- 10:06 AM: Still flagged, no agent response → **AI responds** (5 minutes passed, agent hasn't replied)

**Scenario 3:** Agent sends message at 10:00 AM, customer replies at 10:02 AM

- 10:02 AM: Customer replies → AI can respond immediately (customer engaged, AI resumes)

## To Change Duration

Edit lines ~44 and ~892 in `whatsapp-webhook/index.ts`:

```typescript
// Current: 5 minutes
const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

// Example: Change to 10 minutes
const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
```
