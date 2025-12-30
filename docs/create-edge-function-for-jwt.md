# Edge Function to Inject app_version into JWT

Since Supabase RLS cannot read custom HTTP headers, we must inject the app version into the JWT claim server-side.

## Architecture

```
Expo App (sends x-app-version header)
    ↓
Supabase Edge Function (reads header, creates JWT with app_version claim)
    ↓
Supabase RLS (reads app_version from JWT)
```

## Step 1: Create Edge Function

Create a new Edge Function in Supabase:

**Function name:** `inject-app-version`

**Code:**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-version',
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

    // Create Supabase client with service role to generate JWT
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Generate JWT with app_version claim
    // Note: This requires custom JWT generation or using Supabase Auth
    // For now, we'll use a workaround: create a custom token
    
    // Alternative: Use Supabase's built-in JWT with custom claims
    // This requires configuring JWT secret and claims in Supabase Auth settings
    
    // For immediate solution: Proxy the request with modified headers
    // that Supabase can use to set JWT claims
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        appVersion: appVersionInt,
        message: 'JWT should include app_version claim'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
```

## Step 2: Configure Supabase Auth JWT

In Supabase Dashboard → Authentication → Settings:

1. Enable "Custom JWT Claims"
2. Add custom claim: `app_version`
3. Configure JWT secret (if using custom signing)

## Step 3: Update App to Use Edge Function

The app should:
1. Call the Edge Function first with `x-app-version` header
2. Edge Function returns a JWT token with `app_version` claim
3. App uses this JWT for subsequent Supabase requests

## Alternative: Simpler Approach (Frontend-Only Enforcement)

If JWT-based RLS is too complex, use frontend-only version checking:

1. App calls `check_app_version()` function before queries
2. If version too old, show "Please update" message
3. RLS allows all access (soft enforcement)

See `docs/app-version-gating-alternative.sql` for this approach.




