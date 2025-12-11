import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Send WhatsApp Template Message
 * 
 * This Edge Function sends a WhatsApp template message (with buttons) via Twilio WhatsApp API.
 * Stores the message in the whatsapp_messages table.
 */

Deno.serve(async (req) => {
  try {
    // Get Twilio credentials from Supabase Secrets
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER') || 'whatsapp:+14155238886';

    // Validate credentials exist
    if (!twilioAccountSid || !twilioAuthToken) {
      return new Response(
        JSON.stringify({ error: 'Twilio credentials not configured' }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse request body from your app
    const { to, contentSid, contentVariables, leadId, customerName } = await req.json();

    // Validate required fields
    if (!to || !contentSid) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to and contentSid are required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Build Twilio API URL
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;

    // Prepare request body for Twilio
    const formData = new URLSearchParams();
    formData.append('To', `whatsapp:${to}`);
    formData.append('From', twilioWhatsAppNumber);
    formData.append('ContentSid', contentSid);
    
    // Add content variables if provided
    if (contentVariables) {
      formData.append('ContentVariables', JSON.stringify(contentVariables));
    }

    // Make request to Twilio API
    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const twilioData = await twilioResponse.json();

    // Check if Twilio request was successful
    if (!twilioResponse.ok) {
      console.error('Twilio API Error:', twilioData);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send WhatsApp message',
          details: twilioData 
        }),
        { 
          status: twilioResponse.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Store message in database
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      try {
        // Get template content for message body
        const messageBody = `Template message sent (Template SID: ${contentSid})`;
        
        const { data: insertedMessage, error: insertError } = await supabase
          .from('whatsapp_messages')
          .insert({
            lead_id: leadId || null,
            customer_phone: to,
            customer_name: customerName || null,
            message_body: messageBody,
            message_sid: twilioData.sid || null,
            message_type: 'template',
            direction: 'outbound',
            template_sid: contentSid,
            template_variables: contentVariables || null,
            status: twilioData.status || 'queued',
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error storing message in database:', {
            error: insertError,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            code: insertError.code,
          });
        } else {
          console.log('Message stored successfully in database:', insertedMessage.id);
        }
      } catch (dbError) {
        console.error('Exception while storing message in database:', dbError);
      }

      // Update lead's message sent date
      if (leadId) {
        try {
          await supabase
            .from('leads')
            .update({
              whatsapp_message_sent_date: new Date().toISOString(),
            })
            .eq('id', leadId);
        } catch (updateError) {
          console.error('Error updating lead:', updateError);
        }
      }
    }

    // Success!
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'WhatsApp message sent successfully',
        twilioResponse: twilioData
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Edge Function Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});

