import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore - JSR imports work at runtime in Supabase Edge Functions
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Proactive Follow-up for Package Delivery
 * 
 * This function follows up with customers who said they didn't receive their package
 * 24-48 hours after they reported it.
 * 
 * Should be called every 12 hours via cron job.
 */

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

    // Call the webhook function with action parameter to trigger package follow-up
    const webhookUrl = `${supabaseUrl.replace('/rest/v1', '')}/functions/v1/whatsapp-webhook?action=followup-package`;
    
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
        message: "Package follow-up checker triggered",
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
    console.error("Error in package follow-up:", error);
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

