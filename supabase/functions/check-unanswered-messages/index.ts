import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore - JSR imports work at runtime in Supabase Edge Functions
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Proactive Checker for Unanswered Messages
 * 
 * This function checks for customer messages that haven't been replied to
 * and proactively responds using the AI chatbot.
 * 
 * Should be called every 10 minutes via cron job.
 */

// Copy the necessary helper functions and logic from whatsapp-webhook
// Since we can't easily import from another function, we'll need to copy what we need
// OR call the webhook function's internal logic

Deno.serve(async (req) => {
  // Handle CORS
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

  try {
    // Initialize Supabase client
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

    // Call the webhook function with action parameter to trigger proactive checker
    const webhookUrl = `${supabaseUrl.replace('/rest/v1', '')}/functions/v1/whatsapp-webhook?action=check-unanswered`;
    
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      // Don't send a body - we're using query parameter instead
    });

    const result = await response.json();
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Proactive checker triggered",
        webhookResponse: result,
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
    console.error("Error in proactive checker:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
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

