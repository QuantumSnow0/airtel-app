import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Send Free-Form WhatsApp Text Message
 *
 * This Edge Function sends a free-form text message (not a template) via Twilio WhatsApp API.
 * Stores the message in the whatsapp_messages table.
 */

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

  try {
    // Get Twilio credentials from Supabase Secrets
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioWhatsAppNumber =
      Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "whatsapp:+14155238886";

    // Validate credentials exist
    if (!twilioAccountSid || !twilioAuthToken) {
      console.error("Twilio credentials missing:", {
        hasAccountSid: !!twilioAccountSid,
        hasAuthToken: !!twilioAuthToken,
      });
      return new Response(
        JSON.stringify({
          error: "Twilio credentials not configured",
          message:
            "Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER as Supabase secrets",
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

    // Parse request body from your app
    const { to, body, leadId, customerName } = await req.json();

    // Validate required fields
    if (!to || !body) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: to and body are required",
          message: `Received: to=${to ? "present" : "missing"}, body=${body ? "present" : "missing"}`,
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

    console.log("Sending WhatsApp text message:", {
      to: to,
      bodyLength: body.length,
      twilioWhatsAppNumber: twilioWhatsAppNumber,
    });

    // Build Twilio API URL
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;

    // Prepare request body for Twilio
    const formData = new URLSearchParams();
    formData.append("To", `whatsapp:${to}`);
    formData.append("From", twilioWhatsAppNumber);
    formData.append("Body", body);

    // Make request to Twilio API
    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const twilioData = await twilioResponse.json();

    // Check if Twilio request was successful
    if (!twilioResponse.ok) {
      console.error("Twilio API Error:", {
        status: twilioResponse.status,
        statusText: twilioResponse.statusText,
        data: twilioData,
      });
      return new Response(
        JSON.stringify({
          error: "Failed to send WhatsApp message",
          message:
            twilioData.message || `Twilio API error: ${twilioResponse.status}`,
          details: twilioData,
        }),
        {
          status: twilioResponse.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Store message in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      try {
        const { data: insertedMessage, error: insertError } = await supabase
          .from("whatsapp_messages")
          .insert({
            lead_id: leadId || null,
            customer_phone: to,
            customer_name: customerName || null,
            message_body: body,
            message_sid: twilioData.sid || null,
            message_type: "text",
            direction: "outbound",
            status: twilioData.status || "queued",
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error storing message in database:", {
            error: insertError,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            code: insertError.code,
          });
        } else {
          console.log(
            "Message stored successfully in database:",
            insertedMessage.id
          );
        }
      } catch (dbError) {
        console.error("Exception while storing message in database:", dbError);
      }
    }

    // Success!
    return new Response(
      JSON.stringify({
        success: true,
        message: "WhatsApp text message sent successfully",
        twilioResponse: twilioData,
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
    console.error("Edge Function Error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
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
