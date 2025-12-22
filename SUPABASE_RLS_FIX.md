# Supabase RLS Policy Fix Guide

## 🚨 Current Issue

Your logs show:
- ✅ Supabase client initializes successfully
- ❌ Queries return empty error messages
- ❌ 500 Internal Server Error from Cloudflare

This is **classic RLS (Row Level Security) blocking access**.

## ✅ Solution: Create RLS Policy

### Step 1: Go to Supabase Dashboard

1. Open your Supabase project dashboard
2. Navigate to: **Authentication** → **Policies**
3. Select the `leads` table

### Step 2: Create a Policy for Read Access

Click **"New Policy"** and create:

**Policy Name**: `Allow public read access`

**Policy Definition**:
```sql
CREATE POLICY "Allow public read access" ON public.leads
FOR SELECT
USING (true);
```

Or use the visual editor:
- **Operation**: SELECT
- **Target roles**: `public` (or `anon`)
- **USING expression**: `true` (allows all rows)

### Step 3: Verify Table Exists

1. Go to **Table Editor** → `leads` table
2. Verify the table exists and has the correct columns
3. Check if there's any data

### Step 4: Test Connection

After creating the policy, restart your app and check if queries work.

## 🔍 Alternative: Check Project Status

If RLS policies are correct, check:

1. **Project Status**: 
   - Go to Supabase Dashboard → Settings → General
   - Check if project is paused or has issues

2. **API Settings**:
   - Go to Settings → API
   - Verify URL and anon key match what's in your app

3. **Network Issues**:
   - Try accessing Supabase dashboard directly
   - Check if Cloudflare is blocking your region/IP

## 📝 Quick Test Query

You can test in Supabase SQL Editor:

```sql
-- Test if you can read from leads table
SELECT COUNT(*) FROM public.leads;

-- If this works, RLS might be the issue
-- If this fails, there's a different problem
```

---

**Most likely fix**: Create the RLS policy above to allow public read access.







