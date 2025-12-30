# JWT-Based RLS Implementation Guide

## Overview

This guide implements true database-level version gating using:
1. Edge Function that validates version and proxies requests
2. RLS policy that blocks direct access (only allows via Edge Function)
3. App updates to use Edge Function instead of direct Supabase calls

## Step 1: Deploy Edge Function

1. Go to Supabase Dashboard → Edge Functions
2. Create new function: `proxy-with-version-check`
3. Copy code from `supabase/functions/proxy-with-version-check/index.ts`
4. Deploy the function

**Required Environment Variables:**
- `SUPABASE_URL` - Auto-set by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Get from Settings → API

## Step 2: Run RLS Policy SQL

Run `docs/app-version-gating-jwt-rls.sql` in Supabase SQL Editor.

This creates a policy that:
- Blocks all direct access (no JWT with app_version = blocked)
- Only allows access via Edge Function (which uses service role)

## Step 3: Update App to Use Edge Function

The app needs to:
1. Call Edge Function instead of Supabase directly
2. Edge Function validates version
3. Edge Function proxies request to Supabase

**Current Status:** The Edge Function code is ready, but the app still uses direct Supabase calls.

## Step 4: Update Supabase Client

We need to modify `lib/supabase.ts` to:
1. Call Edge Function for all requests
2. Or create a wrapper that routes through Edge Function

## Alternative: Simpler Approach

Since modifying all Supabase calls is complex, we can:
1. Keep current app code (direct Supabase calls)
2. Add RLS policy that blocks if no valid JWT
3. Edge Function creates JWT with app_version
4. App gets JWT from Edge Function first
5. App uses JWT for Supabase auth

This is still complex. Let me provide a simpler solution...

