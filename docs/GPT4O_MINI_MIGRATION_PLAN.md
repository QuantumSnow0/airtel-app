# GPT-4o-mini Migration Plan

## Current Status

- ✅ Billing upgraded
- ✅ GPT-4o-mini-2024-07-18 access confirmed
- ⏳ Migration pending discussion

## Current Implementation (Gemini 2.5 Flash)

### Current Behavior:

- **One-time auto-reply per customer** - AI responds once, then agent handles rest
- **No conversation context** - Each message analyzed in isolation
- **Agent takeover** - After first AI reply, all subsequent messages go to agent

### Functions Using AI:

1. **`analyzeMessageWithAI()`** - Analyzes customer messages
   - Determines if message should be flagged for agent review
   - Generates auto-reply responses for simple questions
   - Returns JSON: `{ shouldFlag, response?, reason? }`
   - Current issues: JSON parsing inconsistencies, markdown wrapping
   - **Limitation**: Only looks at current message, no conversation history

2. **`generateButtonClickResponse()`** - Generates button click responses
   - Creates personalized responses for "yes_received" and "no_not_received"
   - Returns plain text response
   - Current issues: Sometimes wraps response in markdown/code blocks

3. **`checkShouldAutoReply()`** - Prevents auto-reply if:
   - Agent sent message in last 2 hours
   - Customer already replied after an AI auto-reply (stops further AI replies)

### Current Configuration:

- Model: `gemini-2.5-flash`
- API: `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent`
- Environment Variable: `GEMINI_API_KEY`
- Free Tier: 15 req/min, 1,500/day (now on paid tier)

---

## NEW REQUIREMENT: Continuous Chatbot with Conversation Context

### Major Change:

**From:** One-time auto-reply → Agent takes over  
**To:** Continuous chatbot that maintains conversation history and context

### New Behavior:

- **Continuous conversation** - AI responds to every customer message (unless agent intervenes)
- **Conversation context** - AI sees previous messages in the conversation
- **Context-aware responses** - Responses are based on full conversation history
- **Agent escalation** - AI can still flag complex issues for agent review
- **Agent intervention** - When agent sends a message, AI steps back temporarily

---

## Migration to GPT-4o-mini-2024-07-18

### Key Implementation Changes Needed:

1. **Fetch Conversation History**
   - Query `whatsapp_messages` table for previous messages with same `customer_phone`
   - Order by `created_at` ascending to build chronological conversation
   - Include both inbound (customer) and outbound (AI/agent) messages
   - Limit to last N messages (e.g., last 20 messages) to manage token costs

2. **Build Conversation Context for GPT**
   - Format messages as chat history: `[{ role: 'user', content: '...' }, { role: 'assistant', content: '...' }]`
   - Include system prompt with customer context (name, service type, etc.)
   - Add current customer message to the conversation

3. **Update `checkShouldAutoReply()` Logic**
   - Still check if agent sent message recently (AI should step back)
   - Remove the "one reply per customer" restriction
   - Allow continuous AI responses unless agent intervenes

4. **New Function: `generateChatbotResponse()`**
   - Replaces `analyzeMessageWithAI()`
   - Takes conversation history as input
   - Returns: `{ response: string, shouldEscalate: boolean, escalationReason?: string }`
   - Uses GPT-4o-mini with conversation context

5. **Escalation Logic**
   - AI can still flag for agent review when:
     - Technical issues beyond AI knowledge
     - Account/billing disputes
     - Complex troubleshooting
     - Customer explicitly requests human agent
   - When escalated, agent takes over and AI steps back

6. **Button Click Responses**
   - Can also use conversation context
   - Or keep as standalone (simpler, faster)

### Questions to Discuss:

1. **Conversation History Limits** ✅ **DECIDED**
   - **Recommendation: Last 5-10 messages** (starting with 5, can adjust)
   - **Rationale**:
     - 5 messages = ~2-3 exchanges (customer + AI), provides good recent context
     - Token cost: ~500-800 tokens (reasonable)
     - Can increase to 10 if needed for better context
   - **Implementation**: Query last N messages ordered by `created_at` DESC, then reverse for chronological order
   - **Time limit**: No time limit needed if we limit by count (last 5 messages regardless of age)
   - **No summarization needed** - Keep it simple for now

2. **Agent Intervention Rules** ✅ **DECIDED**
   - **Strategy: Check conversation history for agent messages**
   - **Logic**:
     1. When fetching conversation history, **exclude agent messages** (where `is_ai_response = false` and `direction = 'outbound'`)
     2. If **most recent outbound message is from agent** (not AI), **don't auto-reply** - agent is handling
     3. If agent message is older and customer replied after it, **AI can resume** (agent finished handling)
   - **Implementation**:
     - In `fetchConversationHistory()`: Filter out agent messages OR mark them separately
     - In `checkShouldAutoReply()`: Check if last outbound message is from agent
     - If agent message exists in last 5 messages and is most recent outbound → skip AI reply
   - **No timeout needed** - AI resumes automatically when customer replies after agent's last message

3. **Escalation Criteria**
   - What specific situations should trigger escalation to agent?
   - Should AI be more or less aggressive in escalating?
   - Should escalation be automatic or require confirmation?

4. **Conversation Context Window**
   - GPT-4o-mini context: 128K tokens
   - How many messages can we safely include?
   - Should we implement message summarization for old conversations?
   - Or just use recent messages (last N)?

5. **Response Format**
   - For chatbot: Plain text response (no JSON needed)
   - For escalation decisions: JSON with `{ response, shouldEscalate, reason }`
   - Or always return text, and use separate logic for escalation?

6. **Button Click Responses**
   - Keep as standalone (no conversation context)?
   - Or integrate with conversation history?
   - Button clicks are usually one-off, so standalone might be better

7. **API Key Management**
   - Supabase Secret name: `OPENAI_API_KEY`?
   - Remove `GEMINI_API_KEY` or keep as fallback?

8. **Model Configuration**
   - Model: `gpt-4o-mini-2024-07-18` (snapshot) for consistency?
   - Or use latest: `gpt-4o-mini` for improvements?

9. **Cost Considerations**
   - Conversation history increases token usage significantly
   - Need to estimate costs with context
   - Should we implement token usage logging?

10. **Testing Strategy**
    - Test with sample conversations (multi-turn)
    - Verify context is maintained across messages
    - Test escalation scenarios
    - Monitor costs closely

---

## Implementation Plan (Draft)

### Phase 1: Setup

- [ ] Add `OPENAI_API_KEY` to Supabase Secrets
- [ ] Test OpenAI API connection
- [ ] Verify model access (`gpt-4o-mini-2024-07-18`)

### Phase 2: Database Query Function

- [ ] Create `fetchConversationHistory()` function
  - Query `whatsapp_messages` by `customer_phone`
  - Order by `created_at` DESC (get most recent first)
  - Limit to last **5 messages** (configurable constant)
  - **Filter**: Include only AI responses (`is_ai_response = true`) and customer messages
  - **Exclude**: Agent messages (`is_ai_response = false` AND `direction = 'outbound'`)
  - Reverse array to chronological order (oldest first) for GPT
  - Return formatted conversation array: `[{ role: 'user'|'assistant', content: string }]`
  - **Also return**: `hasRecentAgentMessage` boolean (if most recent outbound is agent)
  - **Also check**: Look for unanswered messages (flagged messages, customer messages without subsequent AI/agent replies)
  - **Return**: Array of previous unanswered questions if found (for AI to address and apologize for)

### Phase 3: New Chatbot Function

- [ ] Create `generateChatbotResponse()` function
  - Accept: conversation history, current message, customer context
  - Build GPT messages array with system prompt + conversation history
  - **Check for unanswered/flagged messages in conversation history**
  - **If previous unanswered questions found:**
    - Apologize for the delay in response
    - Address and answer those previous questions
    - Then respond to current message
  - **Rate limiting check:** Count customer messages today, if > 20, flag for escalation
  - Call OpenAI API with conversation context (model: `gpt-4o-mini-2024-07-18`)
  - **Error handling:** If OpenAI API fails, return `{ response: null, shouldEscalate: true, escalationReason: "AI service unavailable" }` and tag message as red flag
  - Return: `{ response: string | null, shouldEscalate: boolean, escalationReason?: string }`
  - **Escalation logic:** AI tries best to help with technical issues, only recommends customer care (0733100500) after trying its best

### Phase 4: Update Auto-Reply Logic

- [ ] Modify `handleTextMessageAutoReply()` to:
  - Fetch conversation history before calling AI
  - Pass history to `generateChatbotResponse()`
  - Handle escalation (flag for agent)
  - Send response if not escalated
- [ ] Update `checkShouldAutoReply()`:
  - Remove "one reply per customer" restriction
  - **New agent check**: If `hasRecentAgentMessage` from history → return false
  - **Logic**: If most recent outbound message is from agent (not AI), agent is handling
  - **Rate limiting check**: Count customer messages today, if >= 20, return false (flag for agent)
  - Allow continuous AI responses when agent hasn't intervened

### Phase 4b: Proactive Unanswered Questions Checker

- [ ] Create `checkAndRespondToUnansweredMessages()` function
  - **Purpose:** Proactively scan database for unanswered customer messages
  - **Query logic:**
    - Find customer messages (`direction = 'inbound'`) without subsequent AI/agent replies
    - Check for flagged messages (`needs_agent_review = true`) that haven't been handled
    - Filter: Only check if no agent message sent after customer message (within last 2 hours)
    - Time threshold: Check messages older than X minutes (e.g., 5-10 minutes) to avoid responding too quickly
  - **For each unanswered message:**
    - Fetch full conversation history for that customer
    - Call `generateChatbotResponse()` with conversation context
    - Generate apology + response to unanswered questions
    - Send response via `sendAutoReply()`
    - Update message status to indicate it's been handled
  - **Scheduling options:**
    - Option A: Run as scheduled Supabase Edge Function (cron job)
    - Option B: Trigger from main webhook (after handling current message, check for other unanswered)
    - Option C: Separate background worker/function
  - **Prevent duplicates:** Mark messages as "proactive_response_sent" to avoid responding multiple times

### Phase 4c: Proactive Follow-up for "Didn't Receive Package"

- [ ] Create `followUpOnPackageNotReceived()` function
  - **Purpose:** Proactively follow up with customers who said they didn't receive their package
  - **Query logic:**
    - Find customers with `whatsapp_response = 'no_not_received'` in `leads` table
    - Check if follow-up already sent (add `package_followup_sent` flag or check recent messages)
    - Time threshold: Follow up after X hours/days (e.g., 24-48 hours after "no" response)
    - Filter: Only if no recent agent message (agent might be handling)
  - **For each customer who said "no":**
    - Check database for any updates (check if delivery status changed, check recent messages)
    - Generate follow-up message asking:
      - "Did you get the help you needed?"
      - "Have you received your package now?" (check database if possible)
    - Send proactive follow-up via `sendAutoReply()`
    - Mark follow-up as sent to avoid duplicates
  - **Database check:**
    - Check `whatsapp_response` field in `leads` table - see if it changed to "yes_received"
    - Check recent messages for any updates about delivery
    - Check if there's been activity since the "no" response
  - **Scheduling:** Run as scheduled Edge Function (daily or every 12 hours)
  - **Integration:** Can be part of the same proactive checker function or separate

### Phase 5: Button Click Responses

- [ ] Update `generateButtonClickResponse()` to use OpenAI
- [ ] Decide: Keep standalone or add conversation context?
- [ ] Test button click responses
- [ ] **Track analytics:** Update delivery status in database when button clicked

### Phase 5b: Analytics & Metrics Tracking

- [ ] **Database tracking fields:**
  - Track `package_received` status (yes/no/unknown) in `leads` table
  - Track `customer_satisfaction` status (satisfied/not_satisfied/unknown) in `leads` table
  - Track `satisfaction_followup_sent` flag to prevent duplicate surveys
  - Consider adding `package_delivery_date` timestamp
  - Consider adding `satisfaction_response_date` timestamp
- [ ] **Backfill historical data (CRITICAL):**
  - **Populate from existing `whatsapp_response` field:**
    - If `whatsapp_response = 'yes_received'` → Set `package_received = 'yes'`
    - If `whatsapp_response = 'no_not_received'` → Set `package_received = 'no'`
    - Update `package_delivery_date` from `whatsapp_response_date` if available
  - **Check conversation history for satisfaction:**
    - Scan `whatsapp_messages` for each customer
    - Look for satisfaction keywords/responses in messages
    - Update `customer_satisfaction` based on historical conversations
  - **Run migration script** to backfill all existing records
  - **Important:** Track analytics from ALL previous answers, not just new ones
- [ ] **Update tracking logic (going forward):**
  - When button clicked "yes_received": Set `package_received = 'yes'`, update `package_delivery_date`
  - When button clicked "no_not_received": Set `package_received = 'no'`
  - After package received, ask satisfaction question (or send survey)
  - Track satisfaction response when customer replies
- [ ] **Analytics queries/metrics:**
  - Count: `package_received = 'yes'` (received) - **includes all historical data**
  - Count: `package_received = 'no'` (did not receive) - **includes all historical data**
  - Count: `customer_satisfaction = 'satisfied'` (satisfied) - **includes all historical data**
  - Count: `customer_satisfaction = 'not_satisfied'` (not satisfied) - **includes all historical data**
  - Calculate percentages and trends (includes all historical data)
  - Can be queried from `leads` table for reporting
- [ ] **Satisfaction survey:**
  - After customer confirms package received, send satisfaction question
  - "How satisfied are you with your Airtel 5G Router service?"
  - Track response in database
  - Can be button-based (satisfied/not_satisfied) or scale (1-5)

### Phase 6: Testing

- [ ] Test single message (no history)
- [ ] Test multi-turn conversation (context maintained)
- [ ] Test escalation scenarios (technical issues - AI tries first, then escalates)
- [ ] Test agent intervention (AI steps back)
- [ ] Test multilingual (Swahili/English)
- [ ] Test rate limiting (20 messages per day limit)
- [ ] Test error handling (OpenAI API failure - should flag for agent)
- [ ] Test proactive follow-ups
- [ ] Test handling previous unanswered questions
- [ ] Verify response quality and context awareness
- [ ] Test token usage and costs
- [ ] Test website promotion is included in responses

### Phase 7: Deployment

- [ ] Deploy updated function
- [ ] Monitor logs, costs, and response quality
- [ ] Remove Gemini code (or keep as fallback?)

### Phase 8: Documentation

- [ ] Update `AI_AUTOMATION_SETUP.md`
- [ ] Document conversation history limits
- [ ] Document escalation criteria
- [ ] Update troubleshooting docs
- [ ] Document cost expectations with context

---

## Technical Considerations

### OpenAI API Structure (Chatbot with Context):

```typescript
// Example structure for conversation chatbot
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-4o-mini-2024-07-18", // ✅ Using snapshot for consistency
    messages: [
      {
        role: "system",
        content:
          "You are a helpful customer service assistant for Airtel Router...",
      },
      // Previous conversation messages
      { role: "user", content: "Previous customer message 1" },
      { role: "assistant", content: "Previous AI response 1" },
      { role: "user", content: "Previous customer message 2" },
      { role: "assistant", content: "Previous AI response 2" },
      // Current message
      { role: "user", content: "Current customer message" },
    ],
    temperature: 0.7,
    // Optional: Use JSON mode for escalation decisions
    // response_format: { type: 'json_object' },
  }),
});
```

### Conversation History Format:

```typescript
// Fetch from database and format
interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  is_ai_response?: boolean; // To distinguish AI from agent
}

// Build messages array from whatsapp_messages:
// - direction: 'inbound' → role: 'user' (customer message)
// - direction: 'outbound' + is_ai_response: true → role: 'assistant' (AI response)
// - direction: 'outbound' + is_ai_response: false → EXCLUDE (agent message)

// Example conversation history (last 5 messages):
// 1. Customer: "Hello" (inbound)
// 2. AI: "Hello! How can I help?" (outbound, is_ai_response: true)
// 3. Customer: "When will my router arrive?" (inbound)
// 4. AI: "Let me check that for you..." (outbound, is_ai_response: true)
// 5. Customer: "Thanks" (inbound) ← Current message
//
// GPT sees: [user, assistant, user, assistant, user] (5 messages)

// Agent Intervention Examples:
// Scenario 1: Agent hasn't intervened
//   Last 5: [customer, AI, customer, AI, customer]
//   Most recent outbound: AI → ✅ AI responds
//
// Scenario 2: Agent just intervened
//   Last 5: [customer, AI, customer, AGENT, customer]
//   Most recent outbound: AGENT → ❌ AI steps back
//
// Scenario 3: Agent intervened, customer replied after
//   Last 5: [AGENT, customer, customer, AI, customer]
//   Most recent outbound: AI (after agent) → ✅ AI resumes
```

### Key Differences from Gemini:

- Different endpoint structure
- Different authentication (Bearer token vs query param)
- Different response format
- Supports structured outputs (JSON mode)
- Different error response format

---

## Cost Estimates (WITH Conversation Context)

### Per Message with Context:

- **First message (no history):**
  - Input: ~300-400 tokens (system prompt + message)
  - Output: ~100-150 tokens
  - Cost: ~$0.0001-0.00015 per message

- **Subsequent messages (with history):**
  - Input: ~500-2000 tokens (system + 5-20 previous messages + current)
  - Output: ~100-200 tokens
  - Cost: ~$0.0002-0.0008 per message (depends on history length)

### Example Scenarios:

- **Short conversation (5 messages):** ~800 tokens input = ~$0.0003 per message
- **Medium conversation (10 messages):** ~1500 tokens input = ~$0.0005 per message
- **Long conversation (20 messages):** ~2500 tokens input = ~$0.0008 per message

### Monthly Estimate (500 messages/day, average 10 messages per conversation):

- Average: ~1500 tokens input, 150 tokens output per message
- Cost per message: ~$0.0005
- Daily: 500 × $0.0005 = $0.25/day
- **Monthly: ~$7.50/month**

### Cost Optimization Strategies:

1. **Limit conversation history** - Only include last 10-15 messages
2. **Time-based filtering** - Only include messages from last 7 days
3. **Message summarization** - Summarize old messages (adds complexity)
4. **Token usage logging** - Monitor and optimize based on actual usage

---

## Summary of Major Changes

### Current System → New System

| Aspect               | Current (Gemini)                          | New (GPT-4o-mini Chatbot)                   |
| -------------------- | ----------------------------------------- | ------------------------------------------- |
| **Response Pattern** | One auto-reply per customer, then agent   | Continuous chatbot responses                |
| **Context**          | No conversation history                   | Full conversation history included          |
| **AI Behavior**      | Analyzes each message in isolation        | Maintains conversation context              |
| **Agent Takeover**   | After first AI reply                      | Only when agent intervenes or escalation    |
| **Message Analysis** | `analyzeMessageWithAI()` - single message | `generateChatbotResponse()` - with history  |
| **Token Usage**      | ~300-500 tokens per message               | ~800-2500 tokens per message (with context) |
| **Cost**             | ~$2.70/month                              | ~$7.50/month (estimated)                    |

### Key Technical Changes:

1. ✅ **New Function**: `fetchConversationHistory()` - Gets previous messages
2. ✅ **New Function**: `generateChatbotResponse()` - Replaces `analyzeMessageWithAI()`
3. ✅ **Updated**: `checkShouldAutoReply()` - Remove one-reply restriction
4. ✅ **Updated**: `handleTextMessageAutoReply()` - Use conversation history
5. ✅ **Migration**: Gemini → GPT-4o-mini-2024-07-18

---

## Decisions Made ✅

1. **Conversation History**: **Last 5 messages** (can adjust to 10 if needed)
   - Includes only customer messages and AI responses
   - Excludes agent messages from context
   - Simple, cost-effective, provides good context

2. **Agent Intervention**: **Check most recent outbound message**
   - If most recent outbound is from agent → AI steps back
   - If customer replies after agent's message → AI can resume
   - No timeout needed - dynamic based on conversation state

3. **Escalation Criteria**: ✅ **DECIDED**
   - **Technical issues:** AI should try its best to answer technical issues
   - **Recommend customer care (0733100500) only after it has tried its best**
   - AI should attempt to help first, then escalate if needed
   - Don't escalate immediately - try to resolve first

4. **Button Clicks**: **Keep standalone** (no conversation context needed)
   - Button clicks are usually one-off responses
   - Simpler and faster

5. **Response Format**: ✅ **DECIDED - Hybrid approach (recommended)**
   - Plain text responses for normal interactions
   - Prompt-based escalation detection (no JSON mode needed)
   - Simpler implementation

6. **Model Choice**: ✅ **DECIDED**
   - Use **`gpt-4o-mini-2024-07-18`** (snapshot) for consistency

7. **Error Handling**: ✅ **DECIDED**
   - If OpenAI API fails: **Tag message as red flag** (`needs_agent_review = true`)
   - **Do NOT fallback to anything** - let agent handle failed AI responses

8. **Rate Limiting**: ✅ **DECIDED**
   - **Limit: 20 messages per customer per day**
   - If customer exceeds 20 messages, **flag for agent review**
   - Prevents abuse and excessive costs

9. **Proactive Checker**: ✅ **DECIDED - Every 10 minutes** (as recommended)
   - Run scheduled function every 10 minutes
   - Can adjust based on load

10. **System Prompt**: ✅ **To be drafted** (as recommended)
    - Will include all product information, escalation rules, website promotion, etc.

11. **Database Migration**: ✅ **To be created** (as recommended)
    - SQL scripts for new fields
    - Backfill script for historical data

---

## Product Information for AI Training ✅

### ⚠️ CRITICAL BUSINESS REQUIREMENT ⚠️

**ALWAYS RECOMMEND WEBSITE FOR PURCHASES:**

- **Website:** **www.airtel5grouter.co.ke** (or simply **airtel5grouter.co.ke**)
- **IMPORTANCE:** AI must ALWAYS recommend customers to purchase through the website
- **Why:** Sales must go through the website - if customers go directly to Airtel, we make no revenue
- **When to mention:**
  - When customers ask about purchasing/ordering
  - When customers ask about packages/pricing
  - When customers want to recommend to friends
  - At the end of conversations about the service
- **Format:** "For purchasing, please visit **www.airtel5grouter.co.ke**" or "You can order through our website at **airtel5grouter.co.ke**"

---

### Product: Airtel 5G Smart Connect Outdoor Unit

**What it is:**

- Outdoor unit (ODU) mounted externally (rooftops, poles, exterior walls)
- Captures stronger 5G signals for better connectivity
- Connects to indoor Wi-Fi router via Ethernet
- Ideal for areas with weak indoor 5G reception

**Key Features:**

- Weather-resistant design
- High-gain antenna for strong indoor coverage
- Signal amplification for stable connectivity
- Supports up to 32 simultaneous device connections
- Built-in power backup (5-6 hours during outages)
- Parental and usage controls
- Speeds up to 50 Mbps (with higher-speed plans available)
- Seamless fallback to 4G LTE where 5G isn't available

**Available Packages (Kenya):**

1. **15 Mbps Package**
   - Monthly: KSh 1,999
   - Installation: KSh 1,000 (one-time)
   - **Total First Payment: KSh 2,999** (handled by installer)
   - **Data Cap: 1TB per month**
   - **After 1TB:** Speed reduced to 2 Mbps (service continues)
   - **Expected Speed:** Around 15 Mbps (may fluctuate)

2. **30 Mbps Package**
   - Monthly: KSh 2,999
   - Installation: KSh 1,000 (one-time)
   - **Total First Payment: KSh 3,999** (handled by installer)
   - **Data Cap: 1TB per month**
   - **After 1TB:** Speed reduced to 2 Mbps (service continues)
   - **Expected Speed:** Around 30 Mbps (may fluctuate)

**Speed & Performance:**

- Speeds may fluctuate but expected to be around advertised speeds
- **Test speeds:** Use online tools like **fast.com** or speed test apps
- **Performance factors:** Mostly affected by area - if poor 5G network coverage, can switch to 4G through admin dashboard
- If all fails, contact support: **0733100500**

**Admin Dashboard & Technical Support:**

- **Admin Dashboard:** Customers can manage router settings through admin dashboard
- **Network switching:** Can change speeds from 5G, 4G, or 3G through admin dashboard
- **Access:** AI can guide customers on how to access admin dashboard (by IP address, etc.)
- **Installation info:** Installer will also provide admin dashboard access information
- **Mobile App:** Can manage router using apps like **TZLink**
- **Technical issues:** For technical problems, call support: **0733100500**

**Additional Features:**

- **Device connections:** Supports up to **32 simultaneous device connections**
- **Parental controls:** For parental control features, contact support: **0733100500**
- **Guest network:** For guest network setup, contact support: **0733100500**

**⚠️ PURCHASING & WEBSITE (CRITICAL):**

- **Purchase Website:** **www.airtel5grouter.co.ke** (or **airtel5grouter.co.ke**)
- **AI MUST ALWAYS:** Recommend customers to purchase through the website
- **Reason:** All sales must go through the website - direct Airtel purchases generate no revenue
- **When to mention:**
  - When customers ask about purchasing/ordering
  - When customers ask about packages/pricing
  - When customers want to recommend to friends
  - At appropriate points in conversation
- **Example:** "For purchasing, please visit **www.airtel5grouter.co.ke**" or "You can order through our website at **airtel5grouter.co.ke**"

**Handling Previous Unanswered Questions:**

- **Two approaches:**

  **1. Reactive (when customer sends new message):**
  - Check conversation history for previous messages that were:
    - Flagged for agent review but never answered
    - Customer messages without replies
    - Messages marked as needing review
  - **If previous unanswered questions found:**
    - **Apologize** for the delay in response (e.g., "I apologize for the delay in getting back to you")
    - **Address each previous question** and provide answers
    - **Then respond** to the current message

  **2. Proactive (background checker):**
  - **Scan database periodically** for unanswered customer messages
  - **Find messages:**
    - Customer messages without subsequent AI/agent replies
    - Flagged messages that haven't been handled
    - Messages older than threshold (e.g., 5-10 minutes) to avoid responding too quickly
  - **For each unanswered message:**
    - Fetch conversation history
    - Generate response with apology + answers
    - Send response proactively
    - Mark message as handled to prevent duplicates
  - **Scheduling:** Run as scheduled Edge Function (cron) or background worker
  - **Benefit:** Catches up with customers who haven't sent a new message yet

- **Implementation:**
  - When fetching conversation history, identify messages that need responses
  - Include these in the prompt context so AI can address them
  - AI should naturally incorporate apologies and answers into its response
  - Proactive checker queries database directly for unanswered messages

**Proactive Follow-up for Package Delivery:**

- **For customers who clicked "no, didn't receive package":**
  - **Proactively follow up** after 24-48 hours (don't wait for customer to reply)
  - **Ask:**
    - "Did you get the help you needed?"
    - "Have you received your package now?"
  - **Check database:**
    - Check `whatsapp_response` field in `leads` table - see if it changed from "no_not_received" to "yes_received"
    - Check recent messages for any updates about delivery
    - Check if there's been any activity since the "no" response
  - **Implementation:**
    - Scheduled function that runs daily/every 12 hours
    - Queries for customers with `whatsapp_response = 'no_not_received'`
    - Checks if follow-up already sent (prevent duplicates)
    - Checks database for any updates before asking
    - Generates and sends proactive follow-up message
    - Marks follow-up as sent

**Analytics & Metrics Tracking:**

- **Purpose:** Track valuable business data for insights and reporting

- **Metrics to track:**
  1. **Package Delivery Status:**
     - How many customers received package (`package_received = 'yes'`)
     - How many did not receive (`package_received = 'no'`)
     - Tracked via button clicks (yes_received/no_not_received)
  2. **Customer Satisfaction:**
     - How many customers were satisfied (`customer_satisfaction = 'satisfied'`)
     - How many were not satisfied (`customer_satisfaction = 'not_satisfied'`)
     - Collected via follow-up survey after package delivery

- **Database fields (in `leads` table):**
  - `package_received` (yes/no/unknown) - Updated when button clicked
  - `customer_satisfaction` (satisfied/not_satisfied/unknown) - Updated after survey
  - `package_delivery_date` (timestamp) - When package was received
  - `satisfaction_response_date` (timestamp) - When satisfaction was recorded
  - `satisfaction_followup_sent` (boolean) - Prevent duplicate surveys
- **Backfill historical data (CRITICAL - track from previous answers):**
  - **From existing `whatsapp_response` field:**
    - If `whatsapp_response = 'yes_received'` → Set `package_received = 'yes'`
    - If `whatsapp_response = 'no_not_received'` → Set `package_received = 'no'`
    - Use `whatsapp_response_date` as `package_delivery_date` where applicable
  - **From conversation history:**
    - Scan `whatsapp_messages` table for each customer
    - Look for satisfaction indicators in historical messages
    - Extract and update `customer_satisfaction` from previous conversations
    - Use message timestamps for `satisfaction_response_date`
  - **Migration script:** Run once to backfill all existing records
  - **Important:** Analytics should include ALL historical data, not just new responses
- **Tracking logic (going forward):**
  - Button click "yes_received": Set `package_received = 'yes'`, record `package_delivery_date`
  - Button click "no_not_received": Set `package_received = 'no'`
  - After package received, send satisfaction survey (once per customer)
  - Track satisfaction response in `customer_satisfaction` field
- **Analytics queries:**
  - Count customers by delivery status (includes all historical data)
  - Count customers by satisfaction status (includes all historical data)
  - Calculate percentages and conversion rates (includes all historical data)
  - Trend analysis over time (includes all historical data)
  - Can be queried from `leads` table for reporting/dashboard
  - **All metrics include data from previous answers, not just new responses**

**Promotions & Offers:**

- **Current status:** No current promotions, referral programs, or loyalty rewards
- **Updates:** Will be updated in AI training once any promotions or offers arise

**Data Top-ups:**

- Can purchase additional data: **300GB for KSh 1,000**
- Top-up expires with the current month (does not roll over)
- Available for both packages

**Payment & Resubscription:**

- First payment (monthly + installation) is handled by the installer during setup
- For resubscription after first month:
  - **Airtel lines:** Dial **\*400#** and follow the prompts
  - **Safaricom lines:** Use the **Airtel app**
- Payment reminders sent before renewal date
- For assistance, contact support: 0733100500

**Payment Methods:**

- **Accepted:** Airtel, Airtel Money, or M-Pesa
- **Monthly payment due:** After 30 days
- **Late payments:** If you delay, your subscription will start from the day you paid, counting 30 days from that date
- **No hidden fees** - Transparent pricing
- **Invoices/Receipts:** Customers receive messages (SMS) with invoice/receipt information

**Package Changes:**

- **Can upgrade or downgrade packages** during next monthly payment
- No special procedure required - simply select different package when paying
- **No extra fee** for changing packages
- Changes take effect with the next billing cycle

**Contract & Cancellation:**

- **No contracts** - Flexible month-to-month service
- **Can cancel anytime** - No restrictions
- **No cancellation fees** - Free to cancel whenever you want
- **No cancellation policies** - Simple and straightforward

**Installation:**

- Professional installation included
- Mounted outdoors (rooftop, pole, or exterior wall)
- Flexible mounting options for optimal signal reception
- **Portable** - Can be moved from place to place
- Built-in battery backup (5-6 hours) for portability and power outage protection
- For best performance, mount outdoors at each location for optimal 5G signal reception
- **Location Transfer:** DIY (do-it-yourself) - Simply move the router to new location
- **No transfer fee** - Free to move to any location
- Check coverage at new location before moving (contact support: 0733100500)
- **Installation Process:**
  - After filling the form, Airtel customer care will call from **0733100000** to:
    - Confirm the package selection
    - Make installation plans and schedule
    - Discuss installation timeline/period
  - If you haven't received a call, contact support at **0733100500**
  - **Customer must be present during installation with their ID**
  - **All initial installation done by installer** - Professional setup included

**Important Phone Numbers:**

- **0733100000** - Airtel customer care (calls customer to confirm package and schedule installation)
- **0733100500** - Support line (for technical issues, inquiries, assistance)

**Equipment Included:**

- Router/antenna (outdoor unit)
- Battery
- All necessary cables
- **Everything included - no additional purchases needed**

**Requirements:**

- Location must be accessible for installation
- **Recommended:** Area should have Airtel network coverage (check with support: 0733100500)
- **No prior Airtel service required** - Anyone can subscribe

**Business/Commercial Use:**

- **Can be used for business/commercial purposes**
- Same packages available: 15 Mbps and 30 Mbps (no separate business packages)
- No restrictions on commercial use

**Coverage:**

- Works in areas with Airtel 5G coverage
- Falls back to 4G LTE where 5G is not available
- **Coverage check:** No specific way to check coverage, but if Airtel network is working in your area, the device will work too
- If coverage is not good after installation and all troubleshooting steps from support have been tried:
  - Can request refund by emailing **customerservice@ke.airtel.com**
  - Refund will be processed once approved
  - **Refund only available after all troubleshooting steps have been exhausted**

**Support:**

- **Support number: 0733100500** - For technical issues, inquiries, assistance
- **Installation scheduling: 0733100000** - Airtel customer care calls from this number to confirm package and schedule installation
- For delivery issues, technical problems, account inquiries, or coverage verification

**Warranty & Repairs:**

- For warranty inquiries: Contact customer care at **0733100500**
- If router breaks or has issues:
  - Take it to the **nearest Airtel technician**, OR
  - Call support at **0733100500** for assistance
- No official warranty statement available - contact customer care for specific warranty details

---

## Discussion Points

**Remaining questions:**

1. **Escalation Criteria**: What specific situations should trigger escalation to agent?
   - Technical troubleshooting beyond AI knowledge?
   - Billing/account disputes?
   - Customer explicitly requests human agent?
   - Complex issues requiring account access?

2. **Response Format**:
   - Should AI always respond, or can it decide to escalate without responding?
   - Use JSON mode for escalation decisions, or prompt-based?

3. **Model Choice**:
   - `gpt-4o-mini-2024-07-18` (snapshot) for consistency?
   - Or `gpt-4o-mini` (latest) for improvements?

---

## Next Steps

- [ ] Review and discuss this plan
- [ ] Answer questions above
- [ ] Finalize implementation approach
- [ ] **WAIT FOR "build" COMMAND** before implementing
- [ ] Begin migration when approved
