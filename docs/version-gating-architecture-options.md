# App Version Gating - Architecture Options

## Problem
Supabase/PostgREST does NOT expose custom HTTP headers to RLS policies. Header-based version gating is NOT possible.

## Solution Options

### Option 1: JWT-Based RLS (Most Secure) ⭐

**Architecture:**
```
Expo App → Edge Function (injects app_version into JWT) → Supabase RLS (reads from JWT)
```

**Pros:**
- True database-level enforcement
- Cannot be bypassed by client
- Secure and reliable

**Cons:**
- Requires Edge Function setup
- More complex architecture
- Requires JWT configuration

**Implementation:**
1. Create Edge Function to read `x-app-version` header
2. Generate JWT with `app_version` claim
3. RLS policy reads from `auth.jwt() ->> 'app_version'`
4. See `docs/create-edge-function-for-jwt.md`

---

### Option 2: Frontend-Only Enforcement (Simplest)

**Architecture:**
```
Expo App → Checks version → Shows error if too old → Supabase (no RLS version check)
```

**Pros:**
- Simple to implement
- No backend changes needed
- Works immediately

**Cons:**
- Can be bypassed by modifying app
- Not truly secure
- Relies on client-side checks

**Implementation:**
1. App calls `check_app_version(APP_VERSION)` function
2. If returns false, show "Please update" message
3. RLS allows all access
4. See `docs/app-version-gating-alternative.sql`

---

### Option 3: Backend Proxy (Most Control)

**Architecture:**
```
Expo App → Your Backend API → Validates version → Supabase (with service role)
```

**Pros:**
- Full control over version checking
- Can implement complex logic
- Can log and monitor

**Cons:**
- Requires separate backend
- More infrastructure to maintain
- Additional latency

**Implementation:**
1. Create backend API endpoint
2. Backend validates app version
3. Backend uses service role key for Supabase
4. App calls backend instead of Supabase directly

---

## Recommendation

**For immediate fix:** Use Option 2 (Frontend-Only) to restore app functionality.

**For production:** Implement Option 1 (JWT-Based RLS) for true security.

**Current Status:**
- ❌ Header-based RLS (not supported)
- ✅ JWT-based RLS (supported, requires setup)
- ✅ Frontend-only (works immediately, less secure)










