# Pre-Implementation Checklist

## Critical Decisions Needed

### 1. Escalation Criteria ⚠️
**Status:** Mentioned but not finalized

**Questions:**
- What specific situations should trigger escalation to agent?
- Should AI escalate for:
  - Technical troubleshooting beyond basic knowledge?
  - Billing/account disputes?
  - Customer explicitly requests human agent?
  - Complex issues requiring account access?
  - Complaints or negative feedback?
  - Requests for refunds/cancellations?

**Recommendation:** Define clear escalation triggers so AI knows when to hand off to agent.

---

### 2. Response Format Decision
**Status:** Not decided

**Options:**
- **Option A:** Always return plain text, use prompt-based escalation detection
- **Option B:** Use JSON mode for escalation decisions: `{ response: string, shouldEscalate: boolean, reason?: string }`
- **Option C:** Hybrid - plain text for responses, JSON only when escalation needed

**Recommendation:** Option C (hybrid) - simpler for most cases, structured when needed.

---

### 3. Model Choice
**Status:** Not finalized

**Options:**
- `gpt-4o-mini-2024-07-18` (snapshot) - Consistent behavior, no surprises
- `gpt-4o-mini` (latest) - May have improvements, but behavior could change

**Recommendation:** Start with snapshot for consistency, can upgrade later.

---

### 4. System Prompt Structure
**Status:** Need to draft

**Should include:**
- Role definition (customer service assistant for Airtel 5G Router)
- Product information (all the details we gathered)
- Website promotion requirement (CRITICAL)
- Conversation context instructions
- Escalation criteria
- Tone and style guidelines
- Language support (Swahili/English)

**Action:** Draft complete system prompt before implementation.

---

### 5. Error Handling & Fallbacks
**Status:** Not detailed

**Consider:**
- What if OpenAI API fails?
  - Fallback to flagging for agent?
  - Retry logic?
  - Graceful degradation?
- What if database query fails?
- What if conversation history is too long?
- Rate limiting handling?

**Recommendation:** Implement robust error handling with fallbacks.

---

### 6. Rate Limiting & Cost Control
**Status:** Not addressed

**Consider:**
- OpenAI API rate limits
- Cost per request (with conversation history)
- Daily/monthly budget limits?
- Monitoring and alerts for unexpected costs
- Token usage logging

**Recommendation:** Add rate limiting and cost monitoring.

---

### 7. Database Migration Scripts
**Status:** Not created

**Need:**
- SQL script to add new analytics fields:
  - `package_received`
  - `customer_satisfaction`
  - `package_delivery_date`
  - `satisfaction_response_date`
  - `satisfaction_followup_sent`
- Backfill script to populate from existing data
- Indexes for performance

**Action:** Create migration scripts before deployment.

---

### 8. Proactive Checker Scheduling
**Status:** Mentioned but not finalized

**Questions:**
- How often should proactive checker run? (Every 5 min? 10 min? Hourly?)
- Should it be a Supabase cron job or separate service?
- What's the execution time limit?
- How to handle large backlogs?

**Recommendation:** Start with every 10 minutes, adjust based on load.

---

### 9. Testing Strategy
**Status:** Basic outline only

**Need:**
- Test cases for:
  - Single message (no history)
  - Multi-turn conversations
  - Escalation scenarios
  - Proactive follow-ups
  - Button clicks
  - Error cases
  - Cost/performance testing

**Action:** Create detailed test plan.

---

### 10. Monitoring & Logging
**Status:** Not detailed

**Need:**
- What to log:
  - API calls and responses
  - Token usage
  - Errors
  - Escalations
  - Proactive responses sent
- Where to monitor:
  - Supabase Edge Function logs
  - OpenAI usage dashboard
  - Database analytics

**Recommendation:** Set up comprehensive logging and monitoring.

---

### 11. Edge Cases
**Status:** Not fully considered

**Consider:**
- What if customer sends multiple messages quickly?
- What if conversation history is very long (>5 messages)?
- What if customer switches topics mid-conversation?
- What if customer is abusive/inappropriate?
- What if customer asks about competitors?

**Action:** Define handling for edge cases.

---

### 12. Rollback Plan
**Status:** Not defined

**Need:**
- How to quickly revert if issues arise?
- Keep Gemini code as fallback?
- Feature flag to switch between AI providers?
- Database rollback strategy?

**Recommendation:** Keep Gemini code commented, add feature flag.

---

## Recommended Priority Order

1. **Escalation Criteria** - Critical for AI behavior
2. **System Prompt** - Core of AI responses
3. **Database Migration** - Required before deployment
4. **Error Handling** - Prevents failures
5. **Model Choice** - Simple decision
6. **Response Format** - Affects implementation
7. **Testing Strategy** - Ensures quality
8. **Rate Limiting** - Cost control
9. **Monitoring** - Observability
10. **Proactive Scheduling** - Can tune after launch
11. **Edge Cases** - Can handle as they arise
12. **Rollback Plan** - Safety net

---

## Questions for Discussion

1. What are the specific escalation criteria?
2. Should we use JSON mode or prompt-based?
3. Snapshot or latest model?
4. How often should proactive checker run?
5. What's our cost budget/limit?
6. What's our rollback strategy?




