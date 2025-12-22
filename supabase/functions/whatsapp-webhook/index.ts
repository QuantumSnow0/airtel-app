import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore - JSR imports work at runtime in Supabase Edge Functions
import { createClient } from "jsr:@supabase/supabase-js@2";

// Type declaration for Deno global (available in Supabase Edge Functions)
declare global {
  const Deno: {
    env: {
      get(key: string): string | undefined;
      toObject(): Record<string, string>;
    };
    serve: (handler: (req: Request) => Promise<Response> | Response) => void;
  };
}

// Type declaration for FormData with get method (Deno/Supabase Edge Functions)
// @ts-ignore - FormData in Deno has get() method at runtime
type FormDataWithGet = FormData & {
  get(name: string): FormDataEntryValue | null;
};

/**
 * WhatsApp Webhook Handler
 *
 * Receives all WhatsApp messages from Twilio:
 * 1. Button clicks (interactive template responses)
 * 2. Text messages (free-form customer replies)
 *
 * Stores messages in whatsapp_messages table and updates customer records.
 * Automatically replies to button clicks and text messages using AI.
 *
 * Webhook URL format in Twilio:
 * https://YOUR_PROJECT_ID.supabase.co/functions/v1/whatsapp-webhook
 */

// Helper function to check if we should auto-reply
async function checkShouldAutoReply(
  supabase: any,
  phoneNumber: string,
  messageType: string
): Promise<boolean> {
  // Check if there's been a recent agent message (within last 5 minutes)
  // If yes, don't auto-reply (agent is handling the conversation)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data: recentAgentMessages } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("customer_phone", phoneNumber)
    .eq("direction", "outbound")
    .eq("is_ai_response", false) // Only check non-AI messages (agent messages)
    .gte("created_at", fiveMinutesAgo)
    .limit(1);

  // If there's a recent agent message (within 5 minutes), don't auto-reply
  if (recentAgentMessages && recentAgentMessages.length > 0) {
    console.log("Recent agent message found (within 5 minutes), skipping auto-reply");
    return false;
  }

  // Check most recent outbound message - if it's from agent AND was recent (within 5 min), step back
  const { data: lastOutbound } = await supabase
    .from("whatsapp_messages")
    .select("created_at, is_ai_response")
    .eq("customer_phone", phoneNumber)
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // If most recent outbound is from agent AND it's recent (within 5 min), step back
  // If agent message is older than 5 minutes, AI can respond (agent hasn't responded recently)
  if (lastOutbound && !lastOutbound.is_ai_response) {
    const lastOutboundTime = new Date(lastOutbound.created_at);
    const fiveMinutesAgoTime = new Date(Date.now() - 5 * 60 * 1000);
    
    if (lastOutboundTime >= fiveMinutesAgoTime) {
      console.log("Most recent message is from agent (within 5 minutes), AI stepping back");
      return false;
    } else {
      console.log("Most recent agent message is older than 5 minutes, AI can respond");
    }
  }

  // Rate limiting: Check message count today (limit: 20 messages per customer per day)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: messageCountToday } = await supabase
    .from("whatsapp_messages")
    .select("id", { count: "exact", head: true })
    .eq("customer_phone", phoneNumber)
    .eq("direction", "inbound")
    .gte("created_at", todayStart.toISOString());

  if (messageCountToday && messageCountToday >= 20) {
    console.log(`Rate limit exceeded: ${messageCountToday} messages today (limit: 20)`);
    return false; // Flag for agent instead
  }

  return true;
}

// Fetch conversation history for chatbot context
async function fetchConversationHistory(
  supabase: any,
  phoneNumber: string
): Promise<{
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  hasRecentAgentMessage: boolean;
  unansweredQuestions: Array<string>;
}> {
  // Get last 5 messages for conversation context
  const { data: recentMessages } = await supabase
    .from("whatsapp_messages")
    .select("direction, message_body, is_ai_response, created_at, needs_agent_review, auto_reply_status")
    .eq("customer_phone", phoneNumber)
    .order("created_at", { ascending: false })
    .limit(20); // Get more to filter out agent messages

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  const unansweredQuestions: Array<string> = [];
  let hasRecentAgentMessage = false;

  if (recentMessages && recentMessages.length > 0) {
    // Check if most recent outbound is from agent
    const mostRecentOutbound = recentMessages.find(
      (m) => m.direction === "outbound"
    );
    if (mostRecentOutbound && !mostRecentOutbound.is_ai_response) {
      hasRecentAgentMessage = true;
    }

    // Filter and format messages (exclude agent messages, include AI and customer)
    const filteredMessages = recentMessages
      .filter((m) => {
        // Include customer messages (inbound)
        if (m.direction === "inbound") return true;
        // Include AI messages (outbound + is_ai_response = true)
        if (m.direction === "outbound" && m.is_ai_response === true) return true;
        // Exclude agent messages
        return false;
      })
      .slice(0, 5) // Last 5 messages
      .reverse(); // Reverse to chronological order (oldest first)

    for (const msg of filteredMessages) {
      if (msg.direction === "inbound") {
        messages.push({ role: "user", content: msg.message_body || "" });
        
        // Check if this message was unanswered (flagged but no reply)
        if (msg.needs_agent_review && !msg.auto_reply_status) {
          unansweredQuestions.push(msg.message_body || "");
        }
      } else if (msg.direction === "outbound" && msg.is_ai_response) {
        messages.push({ role: "assistant", content: msg.message_body || "" });
      }
    }

    // Also check for any flagged messages without replies
    for (const msg of recentMessages.slice(5)) {
      if (
        msg.direction === "inbound" &&
        msg.needs_agent_review &&
        !unansweredQuestions.includes(msg.message_body || "")
      ) {
        unansweredQuestions.push(msg.message_body || "");
      }
    }
  }

  return { messages, hasRecentAgentMessage, unansweredQuestions };
}

// System prompt for GPT-4o-mini chatbot
const SYSTEM_PROMPT = `You are a helpful and friendly customer service assistant for Airtel 5G Smart Connect Outdoor Unit in Kenya. Your goal is to provide excellent customer service, answer questions, and help customers with their inquiries about the router service.

CRITICAL: Keep responses SHORT and CONCISE. Only answer what was asked - don't volunteer extra information. Simple questions need simple answers (1-2 sentences). Be conversational and natural, not robotic.

PRODUCT INFORMATION:

What is Airtel 5G Smart Connect Outdoor Unit?
- Outdoor unit (ODU) mounted externally (rooftops, poles, exterior walls)
- Captures stronger 5G signals for better connectivity
- Connects to indoor Wi-Fi router via Ethernet
- Ideal for areas with weak indoor 5G reception

Key Features:
- Weather-resistant design
- High-gain antenna for strong indoor coverage
- Signal amplification for stable connectivity
- Supports up to 32 simultaneous device connections
- Built-in power backup (5-6 hours during outages)
- Parental and usage controls
- Speeds up to 50 Mbps (with higher-speed plans available)
- Seamless fallback to 4G LTE where 5G isn't available
- Portable - Can be moved from place to place

Available Packages (Kenya):
1. 15 Mbps Package: Monthly KSh 1,999 + Installation KSh 1,000 (Total: KSh 2,999 first payment, handled by installer). Data Cap: 1TB per month. After 1TB: Speed reduced to 2 Mbps (service continues). Expected Speed: Around 15 Mbps (may fluctuate).

2. 30 Mbps Package: Monthly KSh 2,999 + Installation KSh 1,000 (Total: KSh 3,999 first payment, handled by installer). Data Cap: 1TB per month. After 1TB: Speed reduced to 2 Mbps (service continues). Expected Speed: Around 30 Mbps (may fluctuate).

Data Top-ups: Can purchase additional data: 300GB for KSh 1,000. Top-up expires with the current month (does not roll over). Available for both packages.

Payment & Resubscription:
- First payment (monthly + installation) is handled by the installer during setup
- For resubscription after first month: Airtel lines: Dial *400# and follow the prompts. Safaricom lines: Use the Airtel app
- Payment reminders sent before renewal date
- Accepted payment methods: Airtel, Airtel Money, or M-Pesa
- Monthly payment due: After 30 days
- Late payments: If you delay, your subscription will start from the day you paid, counting 30 days from that date
- No hidden fees - Transparent pricing
- Invoices/Receipts: Customers receive messages (SMS) with invoice/receipt information

Package Changes: Can upgrade or downgrade packages during next monthly payment. No special procedure required. No extra fee for changing packages. Changes take effect with the next billing cycle.

Contract & Cancellation: No contracts - Flexible month-to-month service. Can cancel anytime - No restrictions. No cancellation fees. No cancellation policies - Simple and straightforward.

Installation:
- Professional installation included
- Mounted outdoors (rooftop, pole, or exterior wall)
- Flexible mounting options for optimal signal reception
- Portable - Can be moved from place to place
- Built-in battery backup (5-6 hours) for portability and power outage protection
- Location Transfer: DIY (do-it-yourself) - Simply move the router to new location. No transfer fee
- IMPORTANT: Fill out the form at www.airtel5grouter.co.ke - After filling the form, Airtel customer care will call from 0733100000 to confirm package and schedule installation
- If you haven't received a call, contact support at 0733100500
- Customer must be present during installation with their ID
- All initial installation done by installer - Professional setup included

Equipment Included: Router/antenna (outdoor unit), Battery, All necessary cables. Everything included - no additional purchases needed.

Requirements: Location must be accessible for installation. Recommended: Area should have Airtel network coverage (check with support: 0733100500). No prior Airtel service required - Anyone can subscribe.

Coverage: Works in areas with Airtel 5G coverage. Falls back to 4G LTE where 5G is not available. Coverage check: No specific way to check coverage, but if Airtel network is working in your area, the device will work too. If coverage is not good after installation and all troubleshooting steps from support have been tried: Can request refund by emailing customerservice@ke.airtel.com. Refund will be processed once approved. Refund only available after all troubleshooting steps have been exhausted.

Speed & Performance: Speeds may fluctuate but expected to be around advertised speeds. Test speeds: Use online tools like fast.com or speed test apps. Performance factors: Mostly affected by area - if poor 5G network coverage, can switch to 4G through admin dashboard. If all fails, contact support: 0733100500.

Admin Dashboard & Technical Support: Customers can manage router settings through admin dashboard. Can change speeds from 5G, 4G, or 3G through admin dashboard. AI can guide customers on how to access admin dashboard (by IP address, etc.). Installer will also provide admin dashboard access information. Mobile App: Can manage router using apps like TZLink. Technical issues: For technical problems, call support: 0733100500.

Additional Features: Supports up to 32 simultaneous device connections. Parental controls: For parental control features, contact support: 0733100500. Guest network: For guest network setup, contact support: 0733100500.

Business/Commercial Use: Can be used for business/commercial purposes. Same packages available: 15 Mbps and 30 Mbps (no separate business packages). No restrictions on commercial use.

Warranty & Repairs: For warranty inquiries: Contact customer care at 0733100500. If router breaks or has issues: Take it to the nearest Airtel technician, OR call support at 0733100500 for assistance. No official warranty statement available - contact customer care for specific warranty details.

Important Phone Numbers:
- 0733100000 - Airtel customer care (calls customer to confirm package and schedule installation)
- 0733100500 - Support line (for technical issues, inquiries, assistance)

CRITICAL REQUIREMENT - Website Promotion:
ALWAYS recommend customers to purchase/fill form through the website: www.airtel5grouter.co.ke (or airtel5grouter.co.ke). All sales must go through the website - direct Airtel purchases generate no revenue. When to mention: 
- When customers ask about purchasing/ordering
- When customers ask about packages/pricing
- When customers ask about installation/forms (mention website is where they fill the form)
- When customers want to recommend to friends
- At appropriate points in conversation
Example: "Fill out the form at www.airtel5grouter.co.ke" or "You can order through our website at airtel5grouter.co.ke"

Escalation Rules:
Technical Issues: Try your best to help with technical issues first. Provide troubleshooting steps and guidance. Only recommend customer care (0733100500) AFTER you have tried your best to help. Be helpful and solution-oriented before escalating.

When to escalate: Only after attempting to help first. Complex issues requiring account access. Billing disputes that can't be resolved. Customer explicitly requests human agent. Issues that clearly require manual intervention.

Handling Previous Unanswered Questions:
If you see previous unanswered questions in the conversation history: Apologize for the delay (e.g., "I apologize for the delay in getting back to you"). Address each previous question and provide answers. Then respond to the current message (if there is one). Be thorough and helpful.

Communication Style:
- Tone: Friendly, professional, helpful, and warm
- Language: Respond in Swahili or English (match customer's language preference)
- Clarity: Be clear and direct, avoid jargon
- Helpfulness: Provide actionable information
- Empathy: Show understanding and care for customer concerns
- Length: Keep responses SHORT and CONCISE - only answer what was asked
  - Simple questions get simple answers (1-2 sentences, 20-50 words)
  - Only provide extra details if the customer asks follow-up questions
  - Don't volunteer information that wasn't requested
  - Don't mention the website unless asked about purchasing/ordering
  - Be conversational and natural, not robotic or overly detailed
  - Maximum 100 words unless it's a complex question requiring detailed explanation

Instructions:
1. Use the conversation history to understand context
2. Answer questions based on the product information above - BUT ONLY ANSWER WHAT WAS ASKED
3. Keep responses SHORT - simple questions need simple answers
4. Always mention the website (www.airtel5grouter.co.ke) when discussing:
   - Purchasing/ordering
   - Filling out forms
   - Installation process (where they fill the form)
   - Package information (where to order)
5. Try to help with technical issues before escalating, but keep it brief
6. Be friendly, professional, and helpful - but conversational, not robotic
7. If you don't know something, acknowledge it briefly and guide them to support (0733100500)
8. Handle multiple questions in one message when appropriate
9. If previous questions were unanswered, address them first
10. CRITICAL: Match the length of your response to the question - don't provide extra details unless asked!

Important Notes:
- You are a chatbot - be transparent but helpful
- You can handle most common questions about packages, pricing, installation, etc.
- For complex technical issues, try first, then escalate
- Always be respectful and professional
- Remember: sales must go through www.airtel5grouter.co.ke`;

// Generate chatbot response using GPT-4o-mini with conversation context
async function generateChatbotResponse(
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  currentMessage: string | null,
  unansweredQuestions: Array<string>,
  customerName: string | null
): Promise<{
  response: string | null;
  shouldEscalate: boolean;
  escalationReason?: string;
}> {
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");

  if (!openAiApiKey) {
    console.warn("OPENAI_API_KEY not set, flagging for agent review");
    return {
      response: null,
      shouldEscalate: true,
      escalationReason: "AI service not configured",
    };
  }

  try {
    // Build messages array for OpenAI
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Add customer name context if available
    if (customerName) {
      messages.push({
        role: "system",
        content: `Customer name: ${customerName}`,
      });
    }

    // Add conversation history
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      });
    }

    // Add context about unanswered questions if any
    if (unansweredQuestions.length > 0) {
      const unansweredContext = `IMPORTANT: The customer had these previous questions that were not answered:\n${unansweredQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nPlease address these questions first, then respond to the current message (if any).`;
      messages.push({ role: "system", content: unansweredContext });
    }

    // Add current message if provided
    if (currentMessage) {
      messages.push({ role: "user", content: currentMessage });
    }

    // Add instruction for escalation detection
    const escalationInstruction = `IMPORTANT: At the end of your response, if you believe this issue requires human agent intervention (after you've tried to help), add this tag: [ESCALATE: reason]. Otherwise, just provide your helpful response.`;
    messages.push({ role: "system", content: escalationInstruction });

    // Call OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-2024-07-18",
        messages: messages,
        temperature: 0.7,
        max_tokens: 200, // Reduced for shorter responses
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);
      return {
        response: null,
        shouldEscalate: true,
        escalationReason: "AI service error",
      };
    }

    // Extract response text
    const responseText = data.choices?.[0]?.message?.content || "";

    if (!responseText || responseText.trim().length === 0) {
      return {
        response: null,
        shouldEscalate: true,
        escalationReason: "Empty AI response",
      };
    }

    // Check for escalation tag
    const escalateMatch = responseText.match(/\[ESCALATE:\s*(.+?)\]/i);
    let shouldEscalate = false;
    let escalationReason: string | undefined;
    let cleanResponse = responseText;

    if (escalateMatch) {
      shouldEscalate = true;
      escalationReason = escalateMatch[1].trim();
      // Remove the escalation tag from response
      cleanResponse = responseText.replace(/\[ESCALATE:.+?\]/i, "").trim();
    }

    // If no response after cleaning, escalate
    if (!cleanResponse || cleanResponse.trim().length === 0) {
      return {
        response: null,
        shouldEscalate: true,
        escalationReason: escalationReason || "Empty AI response",
      };
    }

    // Return response - AI can provide help even if suggesting escalation
    // Only escalate if explicitly requested (we'll send the response AND flag for review)
    return {
      response: cleanResponse,
      shouldEscalate: shouldEscalate, // Escalate if AI explicitly requested it (but still send response)
      escalationReason: shouldEscalate ? escalationReason : undefined,
    };
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    return {
      response: null,
      shouldEscalate: true,
      escalationReason: "AI service unavailable",
    };
  }
}

// Handle button click auto-replies
async function handleButtonClickAutoReply(
  supabase: any,
  phoneNumber: string,
  responseValue: string | null,
  customerId: string | null,
  customerName: string | null,
  inboundMessageId: string
) {
  if (!responseValue) return;

  // Wait 30 seconds before sending auto-reply (so customer doesn't miss it)
  // Note: Using 30 seconds instead of 1 minute due to Edge Function execution limits
  console.log(
    `[${new Date().toISOString()}] Waiting 30 seconds before sending button click auto-reply for ${phoneNumber}...`
  );

  try {
    await new Promise((resolve) => setTimeout(resolve, 30 * 1000));
    console.log(
      `[${new Date().toISOString()}] Delay completed, processing button click auto-reply for ${phoneNumber}`
    );
  } catch (delayError) {
    console.error("Error during delay:", delayError);
    return;
  }

  // Check again if we should still auto-reply (customer might have sent another message)
  const shouldStillReply = await checkShouldAutoReply(
    supabase,
    phoneNumber,
    "button_click"
  );

  if (!shouldStillReply) {
    console.log(
      "Skipping button click auto-reply - conditions changed during delay"
    );
    await supabase
      .from("whatsapp_messages")
      .update({
        auto_reply_status: "manual_only",
      })
      .eq("id", inboundMessageId);
    return;
  }

  // Use AI to generate personalized response based on button click
  const buttonContext =
    responseValue === "yes_received"
      ? "Customer confirmed they received their Airtel Router delivery"
      : responseValue === "no_not_received"
        ? "Customer confirmed they did NOT receive their Airtel Router delivery"
        : null;

  if (!buttonContext) {
    // Unknown button response, don't auto-reply
    return;
  }

  // Generate AI response for button click
  console.log(
    `[${new Date().toISOString()}] Generating AI response for button click: ${responseValue}`
  );
  const aiResponse = await generateButtonClickResponse(
    buttonContext,
    responseValue
  );

  if (aiResponse) {
    // Send the AI-generated auto-reply
    console.log(
      `[${new Date().toISOString()}] Sending AI-generated button click response for ${phoneNumber}`
    );
    await sendAutoReply(
      supabase,
      phoneNumber,
      aiResponse,
      customerId,
      customerName,
      true // is AI response
    );
  } else {
    // Fallback to default messages if AI fails
    console.log("AI response failed, using fallback message");
    let replyMessage = "";
    if (responseValue === "yes_received") {
      replyMessage =
        "Thank you for choosing us. We're pleased to know your device has been delivered successfully. Should you need any assistance, feel free to reach out anytime.";
    } else if (responseValue === "no_not_received") {
      replyMessage =
        "We apologize for that, Airtel is working hard to solve the issue to follow up please reach out to 0733100500";
    }

    if (replyMessage) {
      await sendAutoReply(
        supabase,
        phoneNumber,
        replyMessage,
        customerId,
        customerName
      );
    }
  }
}

// Handle text message auto-replies with AI (continuous chatbot with conversation context)
async function handleTextMessageAutoReply(
  supabase: any,
  phoneNumber: string,
  messageBody: string,
  customerId: string | null,
  customerName: string | null,
  inboundMessageId: string
) {
  // Wait 30 seconds before processing (to make it feel natural)
  // Note: Using 30 seconds instead of 2 minutes due to Edge Function execution limits
  console.log(
    `[${new Date().toISOString()}] Waiting 30 seconds before processing text message auto-reply for ${phoneNumber}...`
  );

  try {
    await new Promise((resolve) => setTimeout(resolve, 30 * 1000));
    console.log(
      `[${new Date().toISOString()}] Delay completed, processing text message auto-reply for ${phoneNumber}`
    );
  } catch (delayError) {
    console.error("Error during delay:", delayError);
    return;
  }

  // Check again if we should still auto-reply (customer might have sent another message)
  const shouldStillReply = await checkShouldAutoReply(
    supabase,
    phoneNumber,
    "text"
  );

  if (!shouldStillReply) {
    console.log("Skipping auto-reply - conditions changed during delay");
    
    // Check if it's rate limit - flag for agent
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: messageCountToday } = await supabase
      .from("whatsapp_messages")
      .select("id", { count: "exact", head: true })
      .eq("customer_phone", phoneNumber)
      .eq("direction", "inbound")
      .gte("created_at", todayStart.toISOString());

    if (messageCountToday && messageCountToday >= 20) {
      // Rate limit exceeded - flag for agent
      await supabase
        .from("whatsapp_messages")
        .update({
          needs_agent_review: true,
          auto_reply_status: "flagged_for_agent",
        })
        .eq("id", inboundMessageId);
    } else {
      await supabase
        .from("whatsapp_messages")
        .update({
          auto_reply_status: "manual_only",
        })
        .eq("id", inboundMessageId);
    }
    return;
  }

  // Fetch conversation history for context
  console.log(
    `[${new Date().toISOString()}] Fetching conversation history for ${phoneNumber}...`
  );
  const { messages, hasRecentAgentMessage, unansweredQuestions } =
    await fetchConversationHistory(supabase, phoneNumber);

  // If agent has recently intervened, don't auto-reply
  if (hasRecentAgentMessage) {
    console.log("Agent has recently intervened, skipping auto-reply");
    await supabase
      .from("whatsapp_messages")
      .update({
        auto_reply_status: "manual_only",
      })
      .eq("id", inboundMessageId);
    return;
  }

  // Generate chatbot response with conversation context
  console.log(
    `[${new Date().toISOString()}] Generating chatbot response with context for ${phoneNumber}...`
  );
  const chatbotResponse = await generateChatbotResponse(
    messages,
    messageBody,
    unansweredQuestions,
    customerName
  );
  console.log(
    `[${new Date().toISOString()}] Chatbot response generated: shouldEscalate=${chatbotResponse.shouldEscalate}, hasResponse=${!!chatbotResponse.response}`
  );

  if (chatbotResponse.shouldEscalate || !chatbotResponse.response) {
    // Escalate to agent
    console.log("Message flagged for agent review:", chatbotResponse.escalationReason);
    await supabase
      .from("whatsapp_messages")
      .update({
        needs_agent_review: true,
        auto_reply_status: "flagged_for_agent",
      })
      .eq("id", inboundMessageId);
    return;
  }

  // Send AI response
  console.log(
    `[${new Date().toISOString()}] Sending AI auto-reply for ${phoneNumber}...`
  );
  await sendAutoReply(
    supabase,
    phoneNumber,
    chatbotResponse.response,
    customerId,
    customerName,
    true // is AI response
  );
  console.log(
    `[${new Date().toISOString()}] AI auto-reply sent successfully for ${phoneNumber}`
  );

  // If AI suggested escalation (but still provided response), flag for agent review
  if (chatbotResponse.shouldEscalate) {
    console.log("AI suggested escalation, flagging message for agent review:", chatbotResponse.escalationReason);
    await supabase
      .from("whatsapp_messages")
      .update({
        needs_agent_review: true,
      })
      .eq("id", inboundMessageId);
  }

  // Update unanswered questions as handled if any were addressed
  if (unansweredQuestions.length > 0) {
    // Mark previous unanswered messages as handled (optional - could add a field for this)
    console.log(`Addressed ${unansweredQuestions.length} previous unanswered questions`);
  }
}

// Generate AI response for button clicks using GPT-4o-mini
async function generateButtonClickResponse(
  context: string,
  buttonValue: string
): Promise<string | null> {
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");

  if (!openAiApiKey) {
    console.warn("OPENAI_API_KEY not set, using fallback message");
    return null;
  }

  try {
    const prompt = `You are a helpful customer service assistant for Airtel 5G Smart Connect Outdoor Unit in Kenya.

Context: ${context}

Generate a friendly, personalized response in Swahili or English (match the customer's likely language). 

For "yes_received": Thank them warmly, confirm their delivery, and offer continued support. Be genuine and appreciative.
For "no_not_received": Apologize sincerely, acknowledge the issue, provide the support number 0733100500, and reassure them that Airtel is working on it.

Keep the response:
- Warm and professional
- Under 60 words
- Include the support number (0733100500) for "no_not_received"
- Natural and conversational

Respond with ONLY the message text (no JSON, no markdown, no code blocks, just the plain response message).`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-2024-07-18",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 150,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error for button click:", data);
      return null;
    }

    // Extract response text
    const responseText = data.choices?.[0]?.message?.content || "";

    // Clean up the response (remove any markdown or JSON formatting)
    const cleanResponse = responseText
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .replace(/^\{[\s\S]*"response"\s*:\s*"([^"]+)"[\s\S]*\}$/i, "$1")
      .trim();

    return cleanResponse.length > 0 ? cleanResponse : null;
  } catch (error) {
    console.error("Error generating button click response:", error);
    return null;
  }
}

// OLD FUNCTION REMOVED - Replaced by generateChatbotResponse() which uses GPT-4o-mini with conversation context

// Send auto-reply message
async function sendAutoReply(
  supabase: any,
  phoneNumber: string,
  messageBody: string,
  customerId: string | null,
  customerName: string | null,
  isAIResponse: boolean = false
) {
  // Get Twilio credentials
  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioWhatsAppNumber =
    Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "whatsapp:+14155238886";

  if (!twilioAccountSid || !twilioAuthToken) {
    console.error("Twilio credentials missing for auto-reply");
    return;
  }

  try {
    // Send message via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append("To", `whatsapp:${phoneNumber}`);
    formData.append("From", twilioWhatsAppNumber);
    formData.append("Body", messageBody);

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Failed to send auto-reply:", twilioData);
      return;
    }

    // Store the auto-reply in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (supabaseUrl && supabaseServiceKey) {
      // Normalize status: map "undelivered" to "failed" (database constraint)
      let normalizedStatus = (twilioData.status || "queued").toLowerCase();
      if (normalizedStatus === "undelivered") {
        normalizedStatus = "failed";
      }

      const { error: insertError } = await supabase
        .from("whatsapp_messages")
        .insert({
          lead_id: customerId,
          customer_phone: phoneNumber,
          customer_name: customerName,
          message_body: messageBody,
          message_sid: twilioData.sid || null,
          message_type: "text",
          direction: "outbound",
          status: normalizedStatus,
          is_ai_response: isAIResponse,
          auto_reply_status: "auto_replied",
        });

      if (insertError) {
        console.error("Error storing auto-reply:", insertError);
      } else {
        console.log("Auto-reply sent and stored successfully");
      }
    }
  } catch (error) {
    console.error("Error sending auto-reply:", error);
  }
}

// Proactive checker for unanswered messages (can be called as scheduled function)
async function checkAndRespondToUnansweredMessages(supabase: any) {
  console.log("[Proactive Checker] Starting check for unanswered messages...");

  try {
    // Find customer messages without subsequent AI/agent replies
    // Messages older than 5 minutes to avoid responding too quickly
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // Get all inbound messages from last 24 hours that don't have outbound replies
    // Include flagged messages too - if agent hasn't responded within 5 min, AI should handle them
    // Don't filter by auto_reply_status - we want to check all messages
    const { data: unansweredMessages } = await supabase
      .from("whatsapp_messages")
      .select("id, customer_phone, message_body, created_at, lead_id, customer_name, needs_agent_review, auto_reply_status")
      .eq("direction", "inbound")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .lt("created_at", fiveMinutesAgo) // Older than 5 minutes
      .order("created_at", { ascending: false });

    console.log(`[Proactive Checker] Query returned ${unansweredMessages?.length || 0} messages from last 24 hours`);

    if (!unansweredMessages || unansweredMessages.length === 0) {
      console.log("[Proactive Checker] No unanswered messages found");
      return;
    }

    console.log(`[Proactive Checker] Found ${unansweredMessages.length} potential unanswered messages`);

    let processedCount = 0;
    let skippedCount = 0;
    let sentCount = 0;

    for (const msg of unansweredMessages) {
      console.log(`[Proactive Checker] Processing message ${msg.id} from ${msg.customer_phone} (${msg.message_body?.substring(0, 30)}...)`);

      // Check if there's been a reply (AI or agent) after this message
      const { data: replies } = await supabase
        .from("whatsapp_messages")
        .select("id, is_ai_response, created_at")
        .eq("customer_phone", msg.customer_phone)
        .eq("direction", "outbound")
        .gt("created_at", msg.created_at)
        .order("created_at", { ascending: false })
        .limit(1);

      // Skip if already replied to
      if (replies && replies.length > 0) {
        skippedCount++;
        console.log(`[Proactive Checker] ⏭️ Skipping ${msg.customer_phone} - already has reply after this message (reply at ${replies[0].created_at})`);
        continue;
      }

      // Also check if message was already marked as auto_replied (but no actual reply exists - might be a bug)
      if (msg.auto_reply_status === "auto_replied" && (!replies || replies.length === 0)) {
        console.log(`[Proactive Checker] ⚠️ Message ${msg.id} marked as auto_replied but no reply found - will process anyway`);
      }

      // Check if agent has responded AFTER this message (not just any recent agent message)
      // Only skip if agent responded after this specific message
      const { data: agentRepliesAfterMessage } = await supabase
        .from("whatsapp_messages")
        .select("id, created_at")
        .eq("customer_phone", msg.customer_phone)
        .eq("direction", "outbound")
        .eq("is_ai_response", false)
        .gt("created_at", msg.created_at)
        .order("created_at", { ascending: false })
        .limit(1);

      if (agentRepliesAfterMessage && agentRepliesAfterMessage.length > 0) {
        // Agent responded after this message - check if it was recent (within 5 min)
        const agentReplyTime = new Date(agentRepliesAfterMessage[0].created_at);
        const fiveMinutesAgoTime = new Date(Date.now() - 5 * 60 * 1000);
        
        if (agentReplyTime >= fiveMinutesAgoTime) {
          skippedCount++;
          console.log(`[Proactive Checker] ⏭️ Skipping ${msg.customer_phone} - agent responded recently after this message`);
          continue; // Agent is handling (recently responded)
        }
        // If agent reply is older than 5 min, continue - AI should respond
        console.log(`[Proactive Checker] ℹ️ Agent responded but it's older than 5 min, AI will respond`);
      }

      // Check if there's a recent agent message (within 5 min) that might indicate agent is handling
      // This is a secondary check - if agent messaged recently but not to this specific message, they might be handling
      const { data: recentAgentMessages } = await supabase
        .from("whatsapp_messages")
        .select("id")
        .eq("customer_phone", msg.customer_phone)
        .eq("direction", "outbound")
        .eq("is_ai_response", false)
        .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .limit(1);

      if (recentAgentMessages && recentAgentMessages.length > 0) {
        skippedCount++;
        console.log(`[Proactive Checker] ⏭️ Skipping ${msg.customer_phone} - agent has recent message (within 5 min)`);
        continue; // Agent is handling
      }

      // Check rate limit and other conditions
      const shouldReply = await checkShouldAutoReply(supabase, msg.customer_phone, "text");
      if (!shouldReply) {
        skippedCount++;
        console.log(`[Proactive Checker] ⏭️ Skipping ${msg.customer_phone} - checkShouldAutoReply returned false`);
        continue;
      }

      processedCount++;

      // Fetch conversation history
      const { messages, unansweredQuestions } = await fetchConversationHistory(
        supabase,
        msg.customer_phone
      );

      // Generate response
      console.log(`[Proactive Checker] Generating response for ${msg.customer_phone} - message: ${msg.message_body?.substring(0, 50)}...`);
      const chatbotResponse = await generateChatbotResponse(
        messages,
        null, // No current message - proactive response
        [...unansweredQuestions, msg.message_body || ""],
        msg.customer_name
      );

      console.log(`[Proactive Checker] Response generated for ${msg.customer_phone}: hasResponse=${!!chatbotResponse.response}, shouldEscalate=${chatbotResponse.shouldEscalate}`);

      // Send response if we have one - even if escalated, we can still send it (just flag for review)
      if (chatbotResponse.response) {
        // Send proactive response
        await sendAutoReply(
          supabase,
          msg.customer_phone,
          chatbotResponse.response,
          msg.lead_id,
          msg.customer_name,
          true
        );

        sentCount++;
        console.log(`[Proactive Checker] ✅ Sent response to ${msg.customer_phone} for message: ${msg.message_body?.substring(0, 50)}...`);

        // Mark message as handled
        await supabase
          .from("whatsapp_messages")
          .update({ auto_reply_status: "auto_replied" })
          .eq("id", msg.id);

        // If escalated, also flag for agent review
        if (chatbotResponse.shouldEscalate) {
          await supabase
            .from("whatsapp_messages")
            .update({ needs_agent_review: true })
            .eq("id", msg.id);
        }
      } else {
        skippedCount++;
        console.log(`[Proactive Checker] ⚠️ No response generated for ${msg.customer_phone} - reason: ${chatbotResponse.escalationReason || "unknown"}`);
      }
    }

    console.log(`[Proactive Checker] ✅ Completed: Found ${unansweredMessages.length} messages, Processed ${processedCount}, Sent ${sentCount}, Skipped ${skippedCount}`);
  } catch (error) {
    console.error("[Proactive Checker] Error:", error);
  }
}

// Proactive follow-up for customers who said "no, didn't receive package"
async function followUpOnPackageNotReceived(supabase: any) {
  console.log("[Package Follow-up] Starting follow-up check...");

  try {
    // Find customers who said "no_not_received" 24-48 hours ago
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: customersWithNo } = await supabase
      .from("leads")
      .select("id, customer_name, airtel_number, alternate_number, whatsapp_response, whatsapp_response_date, package_received")
      .eq("whatsapp_response", "no_not_received")
      .gte("whatsapp_response_date", twoDaysAgo)
      .lte("whatsapp_response_date", oneDayAgo)
      .or("package_received.is.null,package_received.eq.no");

    if (!customersWithNo || customersWithNo.length === 0) {
      console.log("[Package Follow-up] No customers to follow up with");
      return;
    }

    console.log(`[Package Follow-up] Found ${customersWithNo.length} customers to follow up with`);

    for (const customer of customersWithNo) {
      const phoneNumber = customer.alternate_number || customer.airtel_number;

      if (!phoneNumber) continue;

      // Check if follow-up already sent (check recent messages)
      const { data: recentMessages } = await supabase
        .from("whatsapp_messages")
        .select("message_body")
        .eq("customer_phone", phoneNumber)
        .eq("direction", "outbound")
        .eq("is_ai_response", true)
        .gte("created_at", oneDayAgo)
        .order("created_at", { ascending: false })
        .limit(5);

      // Check if we already asked about receiving the package
      const alreadyAsked = recentMessages?.some((m) =>
        m.message_body?.toLowerCase().includes("received your package")
      );

      if (alreadyAsked) {
        continue; // Already followed up
      }

      // Check if customer updated response (changed to yes_received)
      if (customer.package_received === "yes") {
        continue; // Already received
      }

      // Check if agent has intervened
      const shouldReply = await checkShouldAutoReply(supabase, phoneNumber, "text");
      if (!shouldReply) {
        continue;
      }

      // Generate follow-up message
      const followUpMessage = `Hello${customer.customer_name ? ` ${customer.customer_name}` : ""}! I wanted to follow up on your Airtel 5G Router delivery. Did you get the help you needed? Have you received your package now? If you're still experiencing issues, please contact our support team at 0733100500.`;

      await sendAutoReply(
        supabase,
        phoneNumber,
        followUpMessage,
        customer.id,
        customer.customer_name,
        true
      );

      console.log(`[Package Follow-up] Sent follow-up to ${phoneNumber}`);
    }

    console.log("[Package Follow-up] Completed follow-up check");
  } catch (error) {
    console.error("[Package Follow-up] Error:", error);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // Initialize Supabase client early (needed for proactive checkers)
  const supabaseUrl =
    Deno.env.get("SUPABASE_URL") ||
    Deno.env.get("SUPABASE_PROJECT_URL") ||
    Deno.env.get("SUPABASE_SERVICE_URL");

  const supabaseServiceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Supabase configuration missing" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Handle proactive checker triggers via query parameter or header
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "check-unanswered" || req.headers.get("x-action") === "check-unanswered") {
    // Trigger unanswered messages checker
    console.log("[Webhook] Proactive checker triggered via action parameter");
    // Run in background (don't wait for completion)
    checkAndRespondToUnansweredMessages(supabase).catch((error) => {
      console.error("[Webhook] Error in proactive checker:", error);
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Proactive checker for unanswered messages started",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  if (action === "followup-package" || req.headers.get("x-action") === "followup-package") {
    // Trigger package follow-up checker
    console.log("[Webhook] Package follow-up checker triggered via action parameter");
    // Run in background (don't wait for completion)
    followUpOnPackageNotReceived(supabase).catch((error) => {
      console.error("[Webhook] Error in package follow-up:", error);
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Package follow-up checker started",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  // Only accept POST requests for regular webhook
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // Note: Supabase Edge Functions require Authorization header by default
  // For Twilio webhooks, we need to either:
  // 1. Add anon key as query parameter: ?apikey=YOUR_ANON_KEY
  // 2. Or configure function to be publicly accessible in Supabase Dashboard

  try {
    // Get request body (Twilio sends form data, proactive checkers send JSON)
    // But since we check action parameter first and return early, we only get here for Twilio
    // @ts-ignore - FormData.get() exists in Deno runtime
    let formData: FormData;
    
    try {
      formData = await req.formData();
    } catch (error) {
      // If body parsing fails, it might be JSON (from proactive checker that didn't have action param)
      // Or empty body - check if it's a status update or return error
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        // This shouldn't happen if action param is set, but handle gracefully
        return new Response(
          JSON.stringify({ 
            error: "Invalid request format",
            message: "Use ?action=check-unanswered or ?action=followup-package for proactive checkers"
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
      // Re-throw if it's not JSON
      throw error;
    }

    // Extract all relevant fields from Twilio webhook
    // @ts-ignore - FormData.get() exists in Deno runtime
    const messageSid = formData.get("MessageSid")?.toString();
    // @ts-ignore - FormData.get() exists in Deno runtime
    const messageStatus = formData.get("MessageStatus")?.toString(); // Status update: sent, delivered, read, failed
    // @ts-ignore - FormData.get() exists in Deno runtime
    const fromNumber = formData.get("From")?.toString(); // Format: whatsapp:+254...
    // @ts-ignore - FormData.get() exists in Deno runtime
    const toNumber = formData.get("To")?.toString();
    // @ts-ignore - FormData.get() exists in Deno runtime
    const messageBody = formData.get("Body")?.toString() || "";
    // @ts-ignore - FormData.get() exists in Deno runtime
    const buttonPayload = formData.get("ButtonPayload")?.toString();
    // @ts-ignore - FormData.get() exists in Deno runtime
    const buttonText = formData.get("ButtonText")?.toString();
    // @ts-ignore - FormData.get() exists in Deno runtime
    const numMedia = formData.get("NumMedia")?.toString() || "0";

    console.log("Received webhook:", {
      messageSid,
      messageStatus,
      fromNumber,
      toNumber,
      messageBody: messageBody.substring(0, 100), // Log first 100 chars
      buttonPayload,
      buttonText,
      numMedia,
    });

    // Supabase client already initialized above for proactive checkers

    // ============================================
    // HANDLE STATUS UPDATES (Step 2)
    // ============================================
    // If this is a status update (has MessageStatus field), update the message status
    // Status updates have MessageStatus, MessageSid, but may not have Body/From
    if (messageStatus && messageSid) {
      console.log("Processing status update:", {
        messageSid,
        messageStatus,
      });

      // First, get the current status before updating
      const { data: currentMessage } = await supabase
        .from("whatsapp_messages")
        .select("status")
        .eq("message_sid", messageSid)
        .single();

      const oldStatus = currentMessage?.status || "unknown";

      // Normalize status: map "undelivered" to "failed" (database constraint)
      let normalizedStatus = messageStatus.toLowerCase();
      if (normalizedStatus === "undelivered") {
        normalizedStatus = "failed";
      }

      // Find the message by MessageSid and update its status
      const { data: updatedMessage, error: updateError } = await supabase
        .from("whatsapp_messages")
        .update({
          status: normalizedStatus,
        })
        .eq("message_sid", messageSid)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating message status:", {
          error: updateError,
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code,
          messageSid: messageSid,
        });
        // Still return 200 to Twilio so it doesn't retry
        return new Response(
          JSON.stringify({
            success: true,
            message: "Status update received (but update failed)",
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      console.log("Message status updated successfully:", {
        messageSid,
        oldStatus: oldStatus,
        newStatus: normalizedStatus,
        messageId: updatedMessage?.id,
      });

      // Return success to Twilio
      return new Response(
        JSON.stringify({
          success: true,
          message: "Status update processed successfully",
          messageSid,
          status: messageStatus,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // ============================================
    // HANDLE INCOMING MESSAGES (existing logic)
    // ============================================
    // If this is an incoming message (has From), process it as before
    if (!fromNumber) {
      console.error("Missing required field: From (and not a status update)");
      return new Response(
        JSON.stringify({ error: "Missing required field: From" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Extract phone number from Twilio format (whatsapp:+254...)
    const phoneNumber = fromNumber.replace("whatsapp:", "").trim();

    // Determine message type
    let messageType = "text";
    let responseValue: string | null = null;

    if (buttonPayload || buttonText) {
      // This is a button click response
      messageType = "button_click";

      // Map button payloads to response values
      if (
        buttonPayload === "yes_received" ||
        buttonText?.toLowerCase().includes("yes")
      ) {
        responseValue = "yes_received";
      } else if (
        buttonPayload === "no_not_received" ||
        buttonText?.toLowerCase().includes("no")
      ) {
        responseValue = "no_not_received";
      } else {
        responseValue = buttonPayload || buttonText || "unknown";
      }
    } else if (parseInt(numMedia) > 0) {
      // This is a media message
      messageType = "media";
    }
    // Otherwise it's a text message

    // Find the customer by phone number
    const cleanPhoneNumber = phoneNumber.replace(/^\+?254/, "0");
    const phoneNumberWith254 = phoneNumber.startsWith("+")
      ? phoneNumber.substring(1)
      : phoneNumber;
    const phoneNumberWithPlus254 = `+${phoneNumberWith254}`;

    // Query to find customer by phone number (check multiple formats)
    const { data: customers, error: searchError } = await supabase
      .from("leads")
      .select("id, customer_name, airtel_number, alternate_number")
      .or(
        `airtel_number.eq.${phoneNumber},alternate_number.eq.${phoneNumber},airtel_number.eq.${phoneNumberWith254},alternate_number.eq.${phoneNumberWith254},airtel_number.eq.${cleanPhoneNumber},alternate_number.eq.${cleanPhoneNumber},airtel_number.eq.${phoneNumberWithPlus254},alternate_number.eq.${phoneNumberWithPlus254}`
      )
      .limit(1);

    let customerId: string | null = null;
    let customerName: string | null = null;

    if (!searchError && customers && customers.length > 0) {
      const customer = customers[0];
      customerId = customer.id;
      customerName = customer.customer_name;
      console.log("Found customer:", customerId, customerName);
    } else {
      console.warn("Customer not found for phone number:", phoneNumber);

      // Auto-create a new lead for unknown WhatsApp numbers
      // Use alternate_number as primary since this is WhatsApp
      const { data: newLead, error: createError } = await supabase
        .from("leads")
        .insert({
          customer_name: "Unknown Customer", // Will be updated by admin
          airtel_number: "", // Empty since we don't know
          alternate_number: phoneNumber, // Use WhatsApp number
          email: "", // Empty
          preferred_package: "Standard", // Default
          installation_town: "", // Empty
          delivery_landmark: "", // Empty
          visit_date: new Date().toISOString().split("T")[0], // Today as default
          visit_time: "", // Empty
          agent_type: "", // Empty
          enterprise_cp: "", // Empty
          agent_name: "", // Empty
          agent_mobile: "", // Empty
          lead_type: "", // Empty
          connection_type: "", // Empty
          // Note: status and source columns need to be added via migration
          // See docs/database-schema-add-status-source.sql
          // If columns don't exist, these will be ignored by Supabase
          status: "new", // Mark as new/unrecognized
          source: "whatsapp_inbound", // Track source
        })
        .select()
        .single();

      if (!createError && newLead) {
        customerId = newLead.id;
        customerName = newLead.customer_name;
        console.log(
          "Auto-created new lead for unknown number:",
          customerId,
          phoneNumber
        );
      } else {
        console.error("Error auto-creating lead:", createError);
      }
    }

    // Store the message in whatsapp_messages table
    const messageRecord = {
      lead_id: customerId,
      customer_phone: phoneNumber,
      customer_name: customerName,
      message_body: messageBody || buttonText || buttonPayload || "No content",
      message_sid: messageSid || null,
      message_type: messageType,
      direction: "inbound", // This is from customer
      button_payload: buttonPayload || null,
      button_text: buttonText || null,
      status: "delivered", // Customer sent it, so it's delivered
    };

    const { data: insertedMessage, error: insertError } = await supabase
      .from("whatsapp_messages")
      .insert(messageRecord)
      .select()
      .single();

    if (insertError) {
      console.error("Error storing message in database:", {
        error: insertError,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code,
        messageRecord: messageRecord,
      });
      // Continue anyway - we'll still try to update customer response
    } else {
      console.log(
        "Message stored successfully in database:",
        insertedMessage.id
      );
    }

    // If this is a button click, update the customer's response in leads table and track analytics
    if (messageType === "button_click" && customerId && responseValue) {
      const updateData: any = {
        whatsapp_response: responseValue,
        whatsapp_response_date: new Date().toISOString(),
      };

      // Track analytics: package_received status
      if (responseValue === "yes_received") {
        updateData.package_received = "yes";
        updateData.package_delivery_date = new Date().toISOString();
      } else if (responseValue === "no_not_received") {
        updateData.package_received = "no";
      }

      const { error: updateError } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", customerId);

      if (updateError) {
        console.error("Error updating customer response and analytics:", updateError);
      } else {
        console.log("Customer response and analytics updated:", responseValue);
      }
    }

    // ============================================
    // AUTO-REPLY LOGIC
    // ============================================
    // Process auto-replies asynchronously (don't block webhook response)
    if (insertedMessage) {
      // Check if we should auto-reply
      const shouldAutoReply = await checkShouldAutoReply(
        supabase,
        phoneNumber,
        messageType
      );

      if (shouldAutoReply) {
        // Start auto-reply processing (fire and forget - runs in background)
        // Using void to explicitly mark as fire-and-forget
        if (messageType === "button_click") {
          // Auto-reply for button clicks (with 30-second delay)
          void handleButtonClickAutoReply(
            supabase,
            phoneNumber,
            responseValue,
            customerId,
            customerName,
            insertedMessage.id
          ).catch((error) => {
            console.error("Error in button click auto-reply:", error);
            // Update message status on error
            supabase
              .from("whatsapp_messages")
              .update({
                auto_reply_status: "manual_only",
              })
              .eq("id", insertedMessage.id)
              .catch((updateError: unknown) => {
                console.error("Error updating message status:", updateError);
              });
          });
        } else if (messageType === "text") {
          // Schedule auto-reply for text messages (30-second delay)
          void handleTextMessageAutoReply(
            supabase,
            phoneNumber,
            messageBody,
            customerId,
            customerName,
            insertedMessage.id
          ).catch((error) => {
            console.error("Error in text message auto-reply:", error);
            // Update message status on error
            supabase
              .from("whatsapp_messages")
              .update({
                auto_reply_status: "manual_only",
              })
              .eq("id", insertedMessage.id)
              .catch((updateError: unknown) => {
                console.error("Error updating message status:", updateError);
              });
          });
        }
      } else {
        // Mark as manual_only if we shouldn't auto-reply
        await supabase
          .from("whatsapp_messages")
          .update({
            auto_reply_status: "manual_only",
          })
          .eq("id", insertedMessage.id);
      }
    }

    // Return success immediately (Twilio expects 200/204 for webhook)
    // Auto-replies happen in background
    return new Response(
      JSON.stringify({
        success: true,
        message: "Message processed successfully",
        customerId,
        messageType,
        response: responseValue,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
