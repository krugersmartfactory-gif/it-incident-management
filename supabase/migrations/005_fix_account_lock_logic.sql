-- =============================================
-- Fix account lock logic - Lock account after 3rd failed attempt
-- =============================================

-- Update record_failed_login function to lock account after 3rd attempt
CREATE OR REPLACE FUNCTION public.record_failed_login(
  user_email TEXT,
  user_ip TEXT DEFAULT NULL,
  user_agent_string TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  failed_count INTEGER;
BEGIN
  -- Insert failed login attempt
  INSERT INTO public.login_attempts (email, ip_address, user_agent)
  VALUES (user_email, user_ip, user_agent_string);
  
  -- Count total failed attempts in last 1 hour
  SELECT COUNT(*)
  INTO failed_count
  FROM public.login_attempts
  WHERE email = user_email
    AND attempt_time > NOW() - INTERVAL '1 hour';
  
  -- If 3 or more failed attempts, lock the account permanently
  IF failed_count >= 3 THEN
    UPDATE public.users
    SET is_locked = TRUE,
        locked_at = NOW(),
        locked_reason = 'Đăng nhập sai 3 lần'
    WHERE email = user_email
      AND is_locked = FALSE; -- Only lock if not already locked
  END IF;
END;
$$;

-- Update check_account_lock to only check, not lock
CREATE OR REPLACE FUNCTION public.check_account_lock(user_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  failed_attempts INTEGER;
  user_locked BOOLEAN;
  result JSON;
BEGIN
  -- Check if user is permanently locked in users table
  SELECT is_locked INTO user_locked
  FROM public.users
  WHERE email = user_email;
  
  IF user_locked = TRUE THEN
    result := json_build_object(
      'is_locked', true,
      'is_permanent', true,
      'failed_attempts', 0,
      'remaining_seconds', 0,
      'message', 'Tài khoản đã bị khóa. Vui lòng liên hệ Admin để mở khóa.'
    );
    RETURN result;
  END IF;
  
  -- Count failed attempts in last 1 hour
  SELECT COUNT(*)
  INTO failed_attempts
  FROM public.login_attempts
  WHERE email = user_email
    AND attempt_time > NOW() - INTERVAL '1 hour';
  
  -- Return status (not locked yet)
  result := json_build_object(
    'is_locked', false,
    'is_permanent', false,
    'failed_attempts', failed_attempts,
    'remaining_seconds', 0,
    'message', ''
  );
  RETURN result;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.record_failed_login(TEXT, TEXT, TEXT) IS 'Records a failed login attempt and locks account after 3rd attempt';
COMMENT ON FUNCTION public.check_account_lock(TEXT) IS 'Checks if an account is locked (does not perform locking)';
