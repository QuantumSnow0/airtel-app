# Complete Version Blocking Implementation Guide

## Overview

This guide ensures that users with old app versions are **completely blocked** from accessing the app and data. The blocking happens at multiple levels for maximum security.

## Multi-Layer Blocking Strategy

### Layer 1: Frontend Blocking (App Startup)
- **Location**: `app/_layout.tsx` and `lib/version-checker.ts`
- **How it works**: 
  - App checks version on startup
  - If version is too old, shows blocking screen
  - App cannot proceed to any screens
- **Status**: ✅ Implemented with "fail closed" behavior

### Layer 2: API-Level Blocking (Edge Function)
- **Location**: `supabase/functions/proxy-with-version-check/index.ts`
- **How it works**:
  - All Supabase API requests are routed through Edge Function
  - Edge Function checks `x-app-version` header
  - Returns 403 if version is too old
  - Only proxies requests if version is valid
- **Status**: ✅ Implemented

### Layer 3: Database-Level Blocking (RLS)
- **Location**: `docs/enforce-version-blocking.sql`
- **How it works**:
  - RLS policy blocks ALL direct access to `leads` table for `anon` role
  - Forces all traffic through Edge Function
  - Old apps that bypass Edge Function get no data
- **Status**: ⚠️ **NEEDS TO BE RUN** - See setup steps below

## Setup Steps

### Step 1: Run RLS Blocking Policy

Run this SQL in Supabase SQL Editor:

```sql
-- File: docs/enforce-version-blocking.sql
-- This blocks all direct access, forcing traffic through Edge Function
```

**What it does:**
- Blocks all direct queries to `leads` table for `anon` role
- Forces all traffic through the Edge Function
- Edge Function uses `service_role` key (bypasses RLS) to proxy requests

### Step 2: Verify Edge Function is Deployed

Ensure `proxy-with-version-check` Edge Function is deployed and active.

**Check:**
1. Go to Supabase Dashboard → Edge Functions
2. Verify `proxy-with-version-check` is deployed
3. Check logs to ensure it's receiving requests

### Step 3: Test Blocking

**Test 1: Old App Version**
1. Temporarily set `min_app_version = 999` in `app_control` table
2. Reload app
3. Should see blocking screen immediately
4. No data should load

**Test 2: Direct Database Access (Should Fail)**
1. Try querying `leads` table directly with anon key
2. Should return empty/error (RLS blocks it)
3. Only Edge Function can access data

**Test 3: Edge Function with Old Version (Should Fail)**
1. Send request to Edge Function with `x-app-version: 1`
2. Should return 403 error
3. No data returned

## How It Works

### Normal Flow (New App):
```
App (version 3) 
  → Sends request with x-app-version: 3
  → Edge Function checks version (3 >= 3 ✅)
  → Edge Function proxies to Supabase (using service_role)
  → Supabase returns data
  → App displays data
```

### Blocked Flow (Old App):
```
App (version 2) 
  → Sends request with x-app-version: 2
  → Edge Function checks version (2 < 3 ❌)
  → Edge Function returns 403 error
  → App shows blocking screen
  → No data accessed
```

### Bypass Attempt (Old App without Edge Function):
```
Old App (version 1)
  → Tries to query Supabase directly
  → RLS policy blocks (anon role has no access)
  → Returns empty/error
  → No data accessed
```

## Security Features

### ✅ Fail Closed Behavior
- If version check fails (network error, etc.), app is blocked
- Better to block legitimate users than allow old versions

### ✅ Multiple Layers
- Frontend blocks UI access
- Edge Function blocks API access
- RLS blocks direct database access

### ✅ No Bypass Path
- Old apps can't bypass Edge Function (RLS blocks direct access)
- Old apps can't bypass frontend check (app won't load)
- Edge Function validates every request

## Updating Minimum Version

### To Block Old Versions:

1. **Update database**:
   ```sql
   UPDATE app_control SET min_app_version = 4 WHERE id = 1;
   ```

2. **Result**:
   - All apps with version < 4 are immediately blocked
   - Apps with version >= 4 continue working
   - No app rebuild needed (if version 4+ already exists)

### To Release New Version:

1. **Update app code**:
   - Update `APP_VERSION` in `lib/supabase.ts`
   - Update `buildNumber`/`versionCode` in `app.json`

2. **Deploy new build**:
   - Build new version with updated version numbers
   - Deploy to app stores or OTA update

3. **Update minimum version** (after users have updated):
   ```sql
   UPDATE app_control SET min_app_version = 4 WHERE id = 1;
   ```

## Troubleshooting

### Issue: App shows blocking screen even with correct version

**Check:**
1. Verify `APP_VERSION` in `lib/supabase.ts` matches `min_app_version` in database
2. Check Edge Function logs for version check errors
3. Verify Edge Function is deployed and receiving requests

### Issue: Old apps can still access data

**Check:**
1. Verify RLS policy is active: Run `docs/enforce-version-blocking.sql`
2. Check Edge Function is deployed and routing all requests
3. Verify `customFetch` in `lib/supabase.ts` is routing through Edge Function

### Issue: Network errors block legitimate users

**Solution:**
- Current implementation is "fail closed" (blocks on error)
- If this causes issues, you can change `lib/version-checker.ts` to "fail open"
- But this reduces security (old apps might get through)

## Files Modified

1. ✅ `lib/version-checker.ts` - Fail closed behavior
2. ✅ `app/_layout.tsx` - Block on error
3. ✅ `lib/supabase.ts` - Routes through Edge Function
4. ✅ `supabase/functions/proxy-with-version-check/index.ts` - Version validation
5. ⚠️ `docs/enforce-version-blocking.sql` - **NEEDS TO BE RUN**

## Next Steps

1. **Run the SQL script**: Execute `docs/enforce-version-blocking.sql` in Supabase
2. **Test blocking**: Temporarily raise `min_app_version` to test
3. **Monitor logs**: Check Edge Function logs for blocked requests
4. **Update version**: When ready, bump `min_app_version` to block old versions

---

**Status**: ✅ Implementation complete, ⚠️ SQL script needs to be run










