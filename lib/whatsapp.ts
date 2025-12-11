import Constants from "expo-constants";

/**
 * WhatsApp Messaging Service
 *
 * Uses Supabase Edge Function to send WhatsApp messages via Twilio
 * Edge Function: send-whatsapp-message
 */

const supabaseUrl =
  Constants.expoConfig?.extra?.supabaseUrl ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "";
const supabaseAnonKey =
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "";

interface WhatsAppMessageParams {
  /** Recipient WhatsApp number (with country code, e.g., "+254724832555") */
  to: string;
  /** Twilio Content Template SID (e.g., "HXb5b62575e6e4ff6129ad7c8efe1f983e") */
  contentSid: string;
  /** Template variables as object (e.g., {"1":"12/1","2":"3pm"}) */
  contentVariables?: Record<string, string>;
}

interface WhatsAppTextMessageParams {
  /** Recipient WhatsApp number (with country code, e.g., "+254724832555") */
  to: string;
  /** Free-form text message body */
  body: string;
}

interface WhatsAppMessageResponse {
  success: boolean;
  message?: string;
  error?: string;
  details?: any;
  twilioResponse?: any;
}

/**
 * Send WhatsApp message via Supabase Edge Function
 *
 * @param params - Message parameters (to, contentSid, contentVariables)
 * @returns Promise with response data
 *
 * @example
 * ```typescript
 * const result = await sendWhatsAppMessage({
 *   to: "+254724832555",
 *   contentSid: "HXb5b62575e6e4ff6129ad7c8efe1f983e",
 *   contentVariables: {"1":"12/1","2":"3pm"}
 * });
 * ```
 */
export async function sendWhatsAppMessage(
  params: WhatsAppMessageParams
): Promise<WhatsAppMessageResponse> {
  // Validate Supabase is configured
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      success: false,
      error:
        "Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY",
    };
  }

  // Validate required parameters
  if (!params.to || !params.contentSid) {
    return {
      success: false,
      error: "Missing required parameters: to and contentSid are required",
    };
  }

  try {
    // Construct Edge Function URL
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-whatsapp-message`;

    // Call Supabase Edge Function
    const response = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAnonKey}`, // Required for Edge Functions
      },
      body: JSON.stringify({
        to: params.to,
        contentSid: params.contentSid,
        contentVariables: params.contentVariables || {},
      }),
    });

    const data = await response.json();

    // Check if request was successful
    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Failed to send WhatsApp message",
        details: data.details,
      };
    }

    // Success!
    return {
      success: true,
      message: data.message || "WhatsApp message sent successfully",
      twilioResponse: data.twilioResponse,
    };
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Send a free-form text message (not a template)
 *
 * @param params - Message parameters (to, body)
 * @returns Promise with response data
 *
 * @example
 * ```typescript
 * const result = await sendWhatsAppTextMessage({
 *   to: "+254724832555",
 *   body: "Hello! How can I help you?"
 * });
 * ```
 */
export async function sendWhatsAppTextMessage(
  params: WhatsAppTextMessageParams
): Promise<WhatsAppMessageResponse> {
  // Validate Supabase is configured
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      success: false,
      error:
        "Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY",
    };
  }

  // Validate required parameters
  if (!params.to || !params.body) {
    return {
      success: false,
      error: "Missing required parameters: to and body are required",
    };
  }

  try {
    // Construct Edge Function URL
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-whatsapp-text-message`;

    // Call Supabase Edge Function
    const response = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        to: params.to,
        body: params.body,
      }),
    });

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      // If response is not JSON, get text
      const text = await response.text();
      console.error("Edge Function response (not JSON):", text);
      return {
        success: false,
        error: `Edge Function error: ${response.status} ${response.statusText}`,
        details: { rawResponse: text },
      };
    }

    // Check if request was successful
    if (!response.ok) {
      console.error("Edge Function error response:", {
        status: response.status,
        statusText: response.statusText,
        data: data,
      });
      return {
        success: false,
        error:
          data.error || data.message || "Failed to send WhatsApp text message",
        details: data.details || data,
      };
    }

    // Success!
    return {
      success: true,
      message: data.message || "WhatsApp text message sent successfully",
      twilioResponse: data.twilioResponse,
    };
  } catch (error) {
    console.error("Error sending WhatsApp text message:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Helper function to format phone number for WhatsApp
 * Ensures number starts with +254 for Kenya
 */
export function formatWhatsAppNumber(phoneNumber: string): string {
  if (!phoneNumber) return "";

  // Remove any spaces, dashes, or other characters
  let cleaned = phoneNumber.replace(/[\s\-\(\)]/g, "");

  // Remove any existing + prefix to normalize
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }

  // Handle different formats:
  // - If starts with 0 (e.g., 0724832555) → remove 0 and add +254
  // - If starts with 254 (e.g., 254724832555) → add + prefix
  // - Otherwise assume it needs country code

  if (cleaned.startsWith("0")) {
    // Local format: 0724832555 → +254724832555
    // Remove leading 0 and take next 9 digits
    const localNumber = cleaned.substring(1);
    if (localNumber.length === 9) {
      cleaned = "+254" + localNumber;
    } else if (localNumber.length === 10) {
      // Sometimes there's an extra digit, take first 9
      cleaned = "+254" + localNumber.substring(0, 9);
      console.warn(
        "Phone number had extra digit, truncated:",
        phoneNumber,
        "→",
        cleaned
      );
    } else {
      cleaned = "+254" + localNumber;
    }
  } else if (cleaned.startsWith("254")) {
    // Country code without +: 254724832555 → +254724832555
    // Check if it has the correct length (254 + 9 digits = 12 total)
    if (cleaned.length === 12) {
      // Perfect: 254 + 9 digits
      cleaned = "+" + cleaned;
    } else if (cleaned.length === 13) {
      // Has extra digit: 254 + 10 digits, truncate to 12
      cleaned = "+" + cleaned.substring(0, 12);
      console.warn(
        "Phone number had extra digit, truncated:",
        phoneNumber,
        "→",
        cleaned
      );
    } else if (cleaned.length === 11) {
      // Missing one digit: 254 + 8 digits, might be valid but warn
      cleaned = "+" + cleaned;
      console.warn(
        "Phone number might be missing a digit:",
        phoneNumber,
        "→",
        cleaned
      );
    } else {
      // Other length, just add + and let validation catch it
      cleaned = "+" + cleaned;
    }
  } else {
    // Assume it's a local number and needs country code
    // Should be 9 digits for Kenya
    if (cleaned.length === 9) {
      cleaned = "+254" + cleaned;
    } else if (cleaned.length === 10) {
      // Has extra digit, take first 9
      cleaned = "+254" + cleaned.substring(0, 9);
      console.warn(
        "Phone number had extra digit, truncated:",
        phoneNumber,
        "→",
        cleaned
      );
    } else {
      cleaned = "+254" + cleaned;
    }
  }

  // Validate the final format
  // Should be: +254 followed by 9 digits (e.g., +254724832555)
  const kenyaPhoneRegex = /^\+254\d{9}$/;
  if (!kenyaPhoneRegex.test(cleaned)) {
    console.warn(
      "Phone number format might be invalid:",
      phoneNumber,
      "→",
      cleaned,
      "(Expected: +254 followed by 9 digits)"
    );
  }

  return cleaned;
}
