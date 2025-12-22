# Fix Pin Permissions Issue

## Problem

The pin toggle button is not updating the database, even though manual updates work.

## Possible Causes

### 1. Row Level Security (RLS) Policy

The `leads` table might have RLS enabled, which could be blocking updates.

**Solution:**

1. Go to Supabase Dashboard → Authentication → Policies
2. Check if RLS is enabled on the `leads` table
3. If RLS is enabled, you need to create/update a policy to allow updates:

```sql
-- Allow authenticated users to update leads
CREATE POLICY "Allow update on leads"
ON leads
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
```

Or if you want to allow updates without authentication (for service role):

```sql
-- Allow service role to update leads (for edge functions)
CREATE POLICY "Allow service role update on leads"
ON leads
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);
```

### 2. Check Current RLS Policies

Run this query to see existing policies:

```sql
SELECT * FROM pg_policies WHERE tablename = 'leads';
```

### 3. Temporarily Disable RLS (for testing only)

```sql
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
```

**⚠️ Warning:** Only disable RLS for testing. Re-enable it after testing and create proper policies.

### 4. Verify Column Exists

Make sure the `is_pinned` column exists:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'leads' AND column_name = 'is_pinned';
```

### 5. Test Update Directly

Test if updates work from SQL:

```sql
UPDATE leads
SET is_pinned = true
WHERE id = 'your-customer-id-here'
RETURNING id, is_pinned;
```

## Debugging Steps

1. Check the console logs when clicking the pin button
2. Look for error messages with codes like:
   - `PGRST301` - RLS policy violation
   - `42501` - Insufficient privileges
   - `PGRST116` - No rows returned

3. Check Supabase Dashboard → Logs for any errors

## Quick Fix

**The issue:** Your `leads` table has INSERT and SELECT policies, but **no UPDATE policy**. This is why pinning doesn't work.

**Solution:** Run this SQL in Supabase SQL Editor:

```sql
CREATE POLICY "Allow public updates"
ON leads
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);
```

This will allow public (unauthenticated) users to update the `leads` table, which is needed for the pin toggle functionality.

**After running the SQL:**

1. Try pinning a conversation again
2. It should work now!
3. Check the console logs to confirm the update succeeded
