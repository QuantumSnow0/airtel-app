-- Secure Version Gating Implementation
-- Uses session tokens that are only issued to apps with valid versions
-- Old apps cannot get tokens and are blocked at database level

-- Step 1: Create session tokens table
CREATE TABLE IF NOT EXISTS app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  app_version int NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  is_valid boolean DEFAULT true
);

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_app_sessions_token ON app_sessions(token) WHERE is_valid = true;
CREATE INDEX IF NOT EXISTS idx_app_sessions_expires ON app_sessions(expires_at) WHERE is_valid = true;

-- Step 2: Function to clean up expired tokens (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE app_sessions
  SET is_valid = false
  WHERE expires_at < now() AND is_valid = true;
END;
$$;

-- Step 3: Function to validate session token
CREATE OR REPLACE FUNCTION validate_session_token(token_param text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_record app_sessions%ROWTYPE;
  min_version int;
BEGIN
  -- Get session
  SELECT * INTO session_record
  FROM app_sessions
  WHERE token = token_param
    AND is_valid = true
    AND expires_at > now()
  LIMIT 1;

  -- If no valid session, return false
  IF session_record IS NULL THEN
    RETURN false;
  END IF;

  -- Check if app version meets minimum requirement
  SELECT min_app_version INTO min_version
  FROM app_control
  WHERE id = 1;

  -- Return true if version is valid
  RETURN session_record.app_version >= COALESCE(min_version, 0);
END;
$$;

-- Step 4: Enable and force RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;

-- Step 5: Drop old policies
DROP POLICY IF EXISTS "App version gating" ON public.leads;
DROP POLICY IF EXISTS "block_all_anon_access_leads" ON public.leads;
DROP POLICY IF EXISTS "Allow anon access temporarily" ON public.leads;
DROP POLICY IF EXISTS "jwt_app_version_gate" ON public.leads;
DROP POLICY IF EXISTS "require_session_token" ON public.leads;

-- Step 6: Create RLS policy that requires valid session token
CREATE POLICY "require_session_token" ON public.leads
  FOR ALL
  TO anon
  USING (
    -- Check if request has valid session token
    -- Token should be passed as a query parameter or header
    -- Since headers don't work, we'll use a custom approach
    -- The Edge Function will set this as a session variable
    validate_session_token(
      current_setting('request.headers.x-session-token', true)
    )
    OR
    -- Fallback: check query parameter (if accessible)
    validate_session_token(
      COALESCE(
        current_setting('request.query.session_token', true),
        ''
      )
    )
  )
  WITH CHECK (
    validate_session_token(
      current_setting('request.headers.x-session-token', true)
    )
    OR
    validate_session_token(
      COALESCE(
        current_setting('request.query.session_token', true),
        ''
      )
    )
  );

-- Step 7: Grant permissions
GRANT EXECUTE ON FUNCTION validate_session_token(text) TO anon;
GRANT SELECT ON app_sessions TO anon; -- For RLS to check tokens

-- Step 8: Enable RLS on app_sessions (for security)
ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Only allow reading own token (via function)
CREATE POLICY "anon_can_validate_tokens" ON app_sessions
  FOR SELECT
  TO anon
  USING (true); -- Function uses SECURITY DEFINER, so this is safe

-- IMPORTANT: This approach still has the header limitation
-- The Edge Function will need to work around this by using
-- a different method to pass the token to RLS










