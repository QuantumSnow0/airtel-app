import Constants from 'expo-constants';

/**
 * WhatsApp Messaging Service
 * 
 * Uses Supabase Edge Function to send WhatsApp messages via Twilio
 * Edge Function: send-whatsapp-message
 */

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

interface WhatsAppMessageParams {
  /** Recipient WhatsApp number (with country code, e.g., "+254724832555") */
  to: string;
  /** Twilio Content Template SID (e.g., "HXb5b62575e6e4ff6129ad7c8efe1f983e") */
  contentSid: string;
  /** Template variables as object (e.g., {"1":"12/1","2":"3pm"}) */
  contentVariables?: Record<string, string>;
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
      error: 'Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY',
    };
  }

  // Validate required parameters
  if (!params.to || !params.contentSid) {
    return {
      success: false,
      error: 'Missing required parameters: to and contentSid are required',
    };
  }

  try {
    // Construct Edge Function URL
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-whatsapp-message`;

    // Call Supabase Edge Function
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`, // Required for Edge Functions
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
        error: data.error || 'Failed to send WhatsApp message',
        details: data.details,
      };
    }

    // Success!
    return {
      success: true,
      message: data.message || 'WhatsApp message sent successfully',
      twilioResponse: data.twilioResponse,
    };

  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Helper function to format phone number for WhatsApp
 * Ensures number starts with country code
 */
export function formatWhatsAppNumber(phoneNumber: string): string {
  // Remove any spaces, dashes, or other characters
  let cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');
  
  // If doesn't start with +, assume it's a local number and add default country code
  if (!cleaned.startsWith('+')) {
    // You can modify this to add your default country code (e.g., +254 for Kenya)
    if (cleaned.startsWith('0')) {
      // Replace leading 0 with country code
      cleaned = '+254' + cleaned.substring(1);
    } else {
      // Assume it needs country code
      cleaned = '+254' + cleaned;
    }
  }
  
  return cleaned;
}

