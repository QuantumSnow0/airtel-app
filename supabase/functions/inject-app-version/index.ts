// Supabase Edge Function: inject-app-version
// This function reads the x-app-version header and creates a JWT with app_version claim
// The app will use this JWT for all Supabase requests

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { create } from "https://deno.land/x/djwt@v2.8/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-version',
}

interface Payload {
  app_version: number
  role: string
  exp: number
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get app version from header
    const appVersion = req.headers.get('x-app-version') || '0'
    const appVersionInt = parseInt(appVersion, 10) || 0

    // Get Supabase URL and anon key from environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET') ?? ''

    if (!jwtSecret) {
      throw new Error('SUPABASE_JWT_SECRET not configured')
    }

    // Create JWT payload with app_version claim
    const payload: Payload = {
      app_version: appVersionInt,
      role: 'anon',
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours
    }

    // Sign JWT with Supabase JWT secret
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(jwtSecret),
      { name: "HMAC", hash: "HS256" },
      false,
      ["sign"]
    )

    const jwt = await create(
      { alg: "HS256", typ: "JWT" },
      payload,
      key
    )

    // Return JWT token
    return new Response(
      JSON.stringify({ 
        token: jwt,
        app_version: appVersionInt,
        expires_in: 86400 // 24 hours
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
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

