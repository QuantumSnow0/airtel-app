// Supabase Edge Function: get-session-token
// Validates app version and issues a session token
// Old apps cannot get tokens and will be blocked

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const appVersion = req.headers.get('x-app-version') || '0'
    const appVersionInt = parseInt(appVersion, 10) || 0

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Check minimum version
    const { data: appControl, error: controlError } = await supabaseAdmin
      .from('app_control')
      .select('min_app_version')
      .eq('id', 1)
      .single()

    if (controlError) {
      throw new Error(`Failed to check version: ${controlError.message}`)
    }

    const minVersion = appControl?.min_app_version ?? 0

    // Block if version too old
    if (appVersionInt < minVersion) {
      return new Response(
        JSON.stringify({ 
          error: 'App version too old',
          current_version: appVersionInt,
          min_version: minVersion
        }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Generate session token
    const tokenBytes = new Uint8Array(32)
    crypto.getRandomValues(tokenBytes)
    const token = Array.from(tokenBytes, byte => byte.toString(16).padStart(2, '0')).join('')

    // Store token in database (expires in 24 hours)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    const { error: insertError } = await supabaseAdmin
      .from('app_sessions')
      .insert({
        token,
        app_version: appVersionInt,
        expires_at: expiresAt.toISOString(),
        is_valid: true,
      })

    if (insertError) {
      throw new Error(`Failed to create session: ${insertError.message}`)
    }

    return new Response(
      JSON.stringify({ 
        token,
        app_version: appVersionInt,
        expires_at: expiresAt.toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})




