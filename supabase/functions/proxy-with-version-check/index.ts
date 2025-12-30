// Supabase Edge Function: proxy-with-version-check
// This function validates app version and proxies requests to Supabase
// Old apps without this function call will be blocked

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-version',
}

serve(async (req) => {
  // Log EVERY request to verify function is being called
  console.log('🚀 Edge Function received request:', req.method, req.url)
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling CORS preflight')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    console.log('📥 Edge Function processing:', req.method, url.pathname)
    console.log('📋 Full URL:', req.url)
    console.log('📋 Pathname:', url.pathname)
    console.log('📋 Search params:', url.search)
    
    // Get app version from header
    const appVersion = req.headers.get('x-app-version') || '0'
    const appVersionInt = parseInt(appVersion, 10) || 0
    console.log('🔐 App version received:', appVersionInt)

    // Get Supabase credentials
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseServiceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured')
    }

    // Create admin client to check minimum version
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Check minimum required version
    const { data: appControl, error: controlError } = await supabaseAdmin
      .from('app_control')
      .select('min_app_version')
      .eq('id', 1)
      .single()

    if (controlError) {
      throw new Error(`Failed to check version: ${controlError.message}`)
    }

    const minVersion = appControl?.min_app_version ?? 0
    console.log('📊 Min version required:', minVersion, 'Current:', appVersionInt)

    // Block if version is too old
    if (appVersionInt < minVersion) {
      console.log('❌ Version check failed - blocking access')
      return new Response(
        JSON.stringify({ 
          error: 'App version too old',
          message: `Please update the app. Current: ${appVersionInt}, Required: ${minVersion}`,
          current_version: appVersionInt,
          min_version: minVersion
        }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Version check passed - proxy the request to Supabase
    console.log('✅ Version check passed - proxying request')
    
    // Get the original request body and method
    const body = await req.text()
    
    // Extract the path after /proxy-with-version-check
    // The pathname from Edge Function is: /proxy-with-version-check/rest/v1/leads
    // We need to remove /proxy-with-version-check to get: /rest/v1/leads
    let proxyPath = url.pathname.replace('/proxy-with-version-check', '')
    
    // Also handle the case with /functions/v1/ prefix (if present)
    proxyPath = proxyPath.replace('/functions/v1/proxy-with-version-check', '')
    
    // Ensure path starts with /
    if (!proxyPath.startsWith('/')) {
      proxyPath = '/' + proxyPath
    }
    
    // If proxyPath is empty or just '/', that's an error
    if (proxyPath === '/' || proxyPath === '') {
      console.error('❌ Invalid proxy path:', proxyPath, 'from:', url.pathname)
      return new Response(
        JSON.stringify({ error: 'Invalid path', received_path: url.pathname }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    console.log('🔍 Path extraction - original:', url.pathname, 'extracted:', proxyPath)
    
    const proxyUrl = `${supabaseUrl}${proxyPath}${url.search}`
    console.log('🔄 Proxying to:', proxyUrl)
    console.log('📊 Proxy path extracted:', proxyPath)

    // Forward the request to Supabase using service role
    // Preserve important headers from original request
    const proxyHeaders: Record<string, string> = {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Prefer': req.headers.get('Prefer') || 'return=representation',
    };
    
    // Preserve Content-Type if present
    const contentType = req.headers.get('Content-Type');
    if (contentType) {
      proxyHeaders['Content-Type'] = contentType;
    }
    
    // Preserve Range header for pagination
    const range = req.headers.get('Range');
    if (range) {
      proxyHeaders['Range'] = range;
    }
    
    const proxyResponse = await fetch(proxyUrl, {
      method: req.method,
      headers: proxyHeaders,
      body: body || undefined,
    })

    console.log('📤 Supabase response status:', proxyResponse.status)

    // Log all response headers for debugging
    const allHeaders: Record<string, string> = {}
    proxyResponse.headers.forEach((value, key) => {
      allHeaders[key] = value
    })
    console.log('📋 All Supabase response headers:', JSON.stringify(allHeaders))

    // Get response data
    const responseData = await proxyResponse.text()
    console.log('📦 Response data length:', responseData.length)

    // Build response headers - forward ALL headers from Supabase, then add CORS
    const responseHeaders: Record<string, string> = {}
    
    // Forward all headers from Supabase response (except CORS headers which we'll set)
    proxyResponse.headers.forEach((value, key) => {
      // Skip CORS headers - we'll set our own
      const lowerKey = key.toLowerCase()
      if (!lowerKey.startsWith('access-control-')) {
        responseHeaders[key] = value
      }
    })
    
    // Add our CORS headers (these override any CORS headers from Supabase)
    Object.assign(responseHeaders, corsHeaders)
    
    // CRITICAL: Log Content-Range for count queries debugging
    const contentRange = proxyResponse.headers.get('Content-Range')
    if (contentRange) {
      console.log('📊 Content-Range header preserved:', contentRange)
    } else if (req.method === 'HEAD') {
      console.log('⚠️ HEAD request but Content-Range header NOT found in Supabase response')
    }
    
    // Log final headers being sent
    console.log('📤 Final response headers:', JSON.stringify(responseHeaders))

    // Return proxied response with all headers
    return new Response(responseData, {
      status: proxyResponse.status,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('❌ Proxy error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

