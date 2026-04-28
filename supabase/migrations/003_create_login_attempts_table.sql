-- =============================================
-- Create table to track failed login attempts
-- =============================================

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  attempt_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_login_attempts_email ON public.login_attempts(email);
CREATE INDEX idx_login_attempts_time ON public.login_attempts(attempt_time);

-- Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policies (only service role can access)
CREATE POLICY "Service role can manage login attempts"
  ON public.login_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================
-- Function to check if account is locked
-- Returns: { is_locked: boolean, remaining_time: interval }
-- =============================================

CREATE OR REPLACE FUNCTION public.check_account_lock(user_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  failed_attempts INTEGER;
  last_attempt_time TIMESTAMPTZ;
  lock_duration INTERVAL := '15 minutes';
  time_since_last_attempt INTERVAL;
  remaining_lock_time INTERVAL;
  result JSON;
BEGIN
  -- Count failed attempts in the last 15 minutes
  SELECT COUNT(*), MAX(attempt_time)
  INTO failed_attempts, last_attempt_time
  FROM public.login_attempts
  WHERE email = user_email
    AND attempt_time > NOW() - lock_duration;
  
  -- If no failed attempts, account is not locked
  IF failed_attempts IS NULL OR failed_attempts = 0 THEN
    result := json_build_object(
      'is_locked', false,
      'failed_attempts', 0,
      'remaining_seconds', 0
    );
    RETURN result;
  END IF;
  
  -- If 3 or more failed attempts, check if still locked
  IF failed_attempts >= 3 THEN
    time_since_last_attempt := NOW() - last_attempt_time;
    
    IF time_since_last_attempt < lock_duration THEN
      -- Still locked
      remaining_lock_time := lock_duration - time_since_last_attempt;
      result := json_build_object(
        'is_locked', true,
        'failed_attempts', failed_attempts,
        'remaining_seconds', EXTRACT(EPOCH FROM remaining_lock_time)::INTEGER
      );
      RETURN result;
    ELSE
      -- Lock expired, clear old attempts
      DELETE FROM public.login_attempts
      WHERE email = user_email
        AND attempt_time <= NOW() - lock_duration;
      
      result := json_build_object(
        'is_locked', false,
        'failed_attempts', 0,
        'remaining_seconds', 0
      );
      RETURN result;
    END IF;
  END IF;
  
  -- Less than 3 attempts, not locked
  result := json_build_object(
    'is_locked', false,
    'failed_attempts', failed_attempts,
    'remaining_seconds', 0
  );
  RETURN result;
END;
$$;

-- =============================================
-- Function to record failed login attempt
-- =============================================

CREATE OR REPLACE FUNCTION public.record_failed_login(
  user_email TEXT,
  user_ip TEXT DEFAULT NULL,
  user_agent_string TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.login_attempts (email, ip_address, user_agent)
  VALUES (user_email, user_ip, user_agent_string);
END;
$$;

-- =============================================
-- Function to clear failed login attempts (on successful login)
-- =============================================

CREATE OR REPLACE FUNCTION public.clear_failed_logins(user_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.login_attempts
  WHERE email = user_email;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_account_lock(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_account_lock(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_failed_login(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.record_failed_login(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_failed_logins(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.clear_failed_logins(TEXT) TO authenticated;

-- Add comments
COMMENT ON TABLE public.login_attempts IS 'Tracks failed login attempts for account locking';
COMMENT ON FUNCTION public.check_account_lock(TEXT) IS 'Checks if an account is locked due to failed login attempts';
COMMENT ON FUNCTION public.record_failed_login(TEXT, TEXT, TEXT) IS 'Records a failed login attempt';
COMMENT ON FUNCTION public.clear_failed_logins(TEXT) IS 'Clears failed login attempts after successful login';
