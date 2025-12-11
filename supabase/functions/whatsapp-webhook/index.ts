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
  // Check if there's been a recent agent message (within last 2 hours)
  // If yes, don't auto-reply (agent is handling the conversation)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data: recentAgentMessages } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("customer_phone", phoneNumber)
    .eq("direction", "outbound")
    .eq("is_ai_response", false) // Only check non-AI messages (agent messages)
    .gte("created_at", twoHoursAgo)
    .limit(1);

  // If there's a recent agent message, don't auto-reply
  if (recentAgentMessages && recentAgentMessages.length > 0) {
    console.log("Recent agent message found, skipping auto-reply");
    return false;
  }

  // Check if customer already replied after an auto-reply
  // Get the last outbound message (could be auto-reply)
  const { data: lastOutbound } = await supabase
    .from("whatsapp_messages")
    .select("created_at, is_ai_response")
    .eq("customer_phone", phoneNumber)
    .eq("direction", "outbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (lastOutbound && lastOutbound.is_ai_response) {
    // Last message was an AI reply, check if customer already responded
    const { data: customerReplies } = await supabase
      .from("whatsapp_messages")
      .select("id")
      .eq("customer_phone", phoneNumber)
      .eq("direction", "inbound")
      .gt("created_at", lastOutbound.created_at)
      .limit(1);

    if (customerReplies && customerReplies.length > 0) {
      console.log(
        "Customer already replied after auto-reply, skipping further auto-reply"
      );
      return false;
    }
  }

  return true;
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

// Handle text message auto-replies with AI
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
    await supabase
      .from("whatsapp_messages")
      .update({
        auto_reply_status: "manual_only",
      })
      .eq("id", inboundMessageId);
    return;
  }

  // Analyze message with AI
  console.log(
    `[${new Date().toISOString()}] Analyzing message with AI for ${phoneNumber}...`
  );
  const aiAnalysis = await analyzeMessageWithAI(messageBody);
  console.log(
    `[${new Date().toISOString()}] AI analysis complete: shouldFlag=${aiAnalysis.shouldFlag}, hasResponse=${!!aiAnalysis.response}`
  );

  if (aiAnalysis.shouldFlag) {
    // Complex question - flag for agent review
    console.log("Message flagged for agent review:", aiAnalysis.reason);
    await supabase
      .from("whatsapp_messages")
      .update({
        needs_agent_review: true,
        auto_reply_status: "flagged_for_agent",
      })
      .eq("id", inboundMessageId);
    return;
  }

  if (aiAnalysis.response) {
    // Simple question - send AI response
    console.log(
      `[${new Date().toISOString()}] Sending AI auto-reply for ${phoneNumber}...`
    );
    await sendAutoReply(
      supabase,
      phoneNumber,
      aiAnalysis.response,
      customerId,
      customerName,
      true // is AI response
    );
    console.log(
      `[${new Date().toISOString()}] AI auto-reply sent successfully for ${phoneNumber}`
    );
  } else {
    // AI couldn't generate response, flag for agent
    await supabase
      .from("whatsapp_messages")
      .update({
        needs_agent_review: true,
        auto_reply_status: "flagged_for_agent",
      })
      .eq("id", inboundMessageId);
  }
}

// Generate AI response for button clicks
async function generateButtonClickResponse(
  context: string,
  buttonValue: string
): Promise<string | null> {
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

  if (!geminiApiKey) {
    console.warn("GEMINI_API_KEY not set, using fallback message");
    return null;
  }

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

    const prompt = `You are a helpful customer service assistant for Airtel Router installation and delivery service in Kenya.

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

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error for button click:", data);
      return null;
    }

    // Extract response text from Gemini
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

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

// Analyze message with Google Gemini AI
async function analyzeMessageWithAI(messageBody: string): Promise<{
  shouldFlag: boolean;
  response?: string;
  reason?: string;
}> {
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

  if (!geminiApiKey) {
    console.warn("GEMINI_API_KEY not set, flagging message for agent review");
    return {
      shouldFlag: true,
      reason: "AI service not configured",
    };
  }

  try {
    // Call Google Gemini API
    // Using gemini-2.5-flash (fast, latest model) with v1 API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

    const prompt = `You are a helpful customer service assistant for Airtel Router installation and delivery service in Kenya.

CONTEXT: This is an Airtel Router service. Customers typically ask about:
- Router delivery status ("did not receive", "when will it arrive")
- Installation appointments
- Package information and pricing
- General service inquiries

Customer message: "${messageBody}"

INSTRUCTIONS:
1. Understand the context - messages like "no i did not receive it" or "not received" are about router delivery
2. Be direct and helpful - provide useful information, don't just ask more questions
3. Only flag for agent if it's: technical troubleshooting, account changes, billing disputes, or requires personal account access

EXAMPLES:
- "no i did not receive it" → Respond: "I understand you haven't received your router yet. Our team is working on your delivery. For immediate assistance, please contact 0733100500 and they will help track your order."
- "yes" → Respond: "Thank you for confirming! Is there anything else I can help you with regarding your Airtel Router service?"
- "hello" → Respond: "Hello! Welcome to Airtel Router service. How can I assist you today - are you asking about delivery, installation, or our packages?"
- "when will it arrive?" → Respond: "For delivery updates, please contact our support team at 0733100500. They have access to your order status and can provide the exact delivery timeline."

Respond in JSON format ONLY (no markdown, no code blocks):
{
  "isSimple": true/false,
  "shouldFlag": true/false,
  "response": "Direct, helpful response in Swahili or English. Be confident and provide value. If about delivery issues, mention the support number 0733100500. Keep under 80 words.",
  "reason": "Only if shouldFlag is true"
}

Be helpful and direct - default to responding unless it's clearly a complex technical/account issue.`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);
      return {
        shouldFlag: true,
        reason: "AI service error",
      };
    }

    // Extract response text from Gemini
    const responseText =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    // Try to parse JSON from response
    let analysis;
    try {
      // Gemini might wrap JSON in markdown, try to extract it
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        analysis = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", responseText);
      return {
        shouldFlag: true,
        reason: "AI response parsing error",
      };
    }

    // Default to responding (not flagging) if we have a response
    // Only flag if explicitly set to true AND no response provided
    const shouldFlag = analysis.shouldFlag === true && !analysis.response;
    const hasResponse =
      analysis.response && analysis.response.trim().length > 0;

    return {
      shouldFlag: shouldFlag,
      response: hasResponse ? analysis.response : null,
      reason: shouldFlag
        ? analysis.reason || "Complex issue requiring agent review"
        : null,
    };
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return {
      shouldFlag: true,
      reason: "AI service unavailable",
    };
  }
}

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
          status: twilioData.status || "queued",
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

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // Only accept POST requests
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
    // Get request body (Twilio sends form data)
    // @ts-ignore - FormData.get() exists in Deno runtime
    const formData = await req.formData();

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

    // Initialize Supabase client first (needed for both message and status updates)
    const supabaseUrl =
      Deno.env.get("SUPABASE_URL") ||
      Deno.env.get("SUPABASE_PROJECT_URL") ||
      Deno.env.get("SUPABASE_SERVICE_URL");

    const supabaseServiceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Supabase configuration missing", {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseServiceKey,
        envKeys: Object.keys(Deno.env.toObject()),
      });
      return new Response(
        JSON.stringify({
          error:
            "Server configuration error - Supabase credentials not available",
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

      // Find the message by MessageSid and update its status
      const { data: updatedMessage, error: updateError } = await supabase
        .from("whatsapp_messages")
        .update({
          status: messageStatus.toLowerCase(), // Normalize to lowercase
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
        oldStatus: "unknown",
        newStatus: messageStatus,
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

    // If this is a button click, update the customer's response in leads table
    if (messageType === "button_click" && customerId && responseValue) {
      const { error: updateError } = await supabase
        .from("leads")
        .update({
          whatsapp_response: responseValue,
          whatsapp_response_date: new Date().toISOString(),
        })
        .eq("id", customerId);

      if (updateError) {
        console.error("Error updating customer response:", updateError);
      } else {
        console.log("Customer response updated:", responseValue);
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
