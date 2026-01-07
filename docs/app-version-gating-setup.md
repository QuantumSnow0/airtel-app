# App Version Gating Setup Guide

## Overview

This implementation enforces app version gating using Supabase Row Level Security (RLS). Only apps with a version >= the minimum version in the database can access data.

## Implementation Summary

### 1. App Version Constant

**Location**: `lib/supabase.ts`

The app version is set in the `APP_VERSION` constant:
```typescript
export const APP_VERSION = Constants.expoConfig?.ios?.buildNumber 
  ? parseInt(Constants.expoConfig.ios.buildNumber, 10)
  : Constants.expoConfig?.android?.versionCode 
  ? Constants.expoConfig.android.versionCode 
  : 2; // Default fallback
```

**Current Value**: Uses iOS `buildNumber` or Android `versionCode` from `app.json`
- iOS: `buildNumber: "3"` → APP_VERSION = 3
- Android: `versionCode: 3` → APP_VERSION = 3

### 2. Supabase Client Headers

**Location**: `lib/supabase.ts`

Every Supabase request automatically includes:
```
x-app-version: "3"
```

This is set via global headers in the Supabase client configuration.

### 3. Error Handling

**Location**: `lib/supabase-error-handler.ts`

When a permission error occurs (version too old), the app shows:
- Alert: "Please update the app"
- App continues to function (doesn't crash)
- Errors are logged for debugging

## How to Bump Version Without Rebuilding

### Option 1: Update Database Only (Recommended for Quick Gating)

1. **Update the minimum version in Supabase**:
   ```sql
   UPDATE app_control SET min_app_version = 4 WHERE id = 1;
   ```

2. **Result**: 
   - Users with version 3 or lower will see "Please update the app"
   - Users with version 4+ can continue using the app
   - **Note**: This only works if users already have version 4+ installed

### Option 2: Update App Version Constant (Requires OTA Update or New Build)

1. **Update `APP_VERSION` in `lib/supabase.ts`**:
   ```typescript
   export const APP_VERSION = 4; // Change from 3 to 4
   ```

2. **Update `app.json`**:
   ```json
   {
     "ios": { "buildNumber": "4" },
     "android": { "versionCode": 4 }
   }
   ```

3. **Deploy via OTA Update** (if using Expo Updates):
   - Users will get the update automatically
   - New version will send `x-app-version: 4` header

4. **Or create a new build**:
   - Build new version with updated version codes
   - Users need to download new build from app store

### Option 3: Hybrid Approach (Best for Production)

1. **Update database first** (to gate old versions):
   ```sql
   UPDATE app_control SET min_app_version = 4 WHERE id = 1;
   ```

2. **Then update app code and deploy**:
   - Update `APP_VERSION` constant
   - Update `app.json` version codes
   - Deploy OTA update or new build

3. **Result**:
   - Old versions (1-3) are immediately blocked
   - New version (4+) is released and works

## SQL Setup

Run `docs/app-version-gating-rls.sql` in Supabase SQL Editor to:
1. Create `app_control` table
2. Set minimum version to 2
3. Create RLS functions
4. Apply policies to `leads` table

## Testing

1. **Test with current version**:
   - App should work normally (version 3 >= min version 2)

2. **Test with old version**:
   - Update `app_control.min_app_version` to 4
   - App with version 3 should show "Please update the app"
   - App should not crash

3. **Test version bump**:
   - Update `APP_VERSION` to 4
   - Update `app_control.min_app_version` to 4
   - App should work normally

## Important Notes

- **Version is set once** in `lib/supabase.ts` - no hardcoding elsewhere
- **Header is sent automatically** with every Supabase request
- **RLS policies** check the header server-side
- **Error handling** is graceful - app doesn't crash
- **Public anon key** is still used (no backend keys needed)

## Troubleshooting

If version gating isn't working:

1. **Check header is being sent**:
   - Look in Supabase logs for requests
   - Verify `x-app-version` header is present

2. **Check RLS policies**:
   - Verify policies are created and enabled
   - Check `check_app_version()` function works

3. **Check app_control table**:
   ```sql
   SELECT * FROM app_control WHERE id = 1;
   ```

4. **Test function directly**:
   ```sql
   SELECT check_app_version();
   ```











