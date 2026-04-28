-- =============================================
-- Add account lock feature to users table
-- =============================================

-- Add columns to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS locked_reason TEXT,
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_is_locked ON public.users(is_locked);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON public.users(is_admin);

-- =============================================
-- Update check_account_lock function to check users table
-- =============================================

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
  
  -- Count failed attempts (for temporary lock - 3 attempts)
  SELECT COUNT(*)
  INTO failed_attempts
  FROM public.login_attempts
  WHERE email = user_email
    AND attempt_time > NOW() - INTERVAL '1 hour'; -- Check last 1 hour
  
  -- If 3 or more failed attempts, lock account permanently
  IF failed_attempts >= 3 THEN
    -- Lock the account in users table
    UPDATE public.users
    SET is_locked = TRUE,
        locked_at = NOW(),
        locked_reason = 'Đăng nhập sai 3 lần'
    WHERE email = user_email;
    
    result := json_build_object(
      'is_locked', true,
      'is_permanent', true,
      'failed_attempts', failed_attempts,
      'remaining_seconds', 0,
      'message', 'Tài khoản đã bị khóa do đăng nhập sai 3 lần. Vui lòng liên hệ Admin để mở khóa.'
    );
    RETURN result;
  END IF;
  
  -- Not locked
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

-- =============================================
-- Function to unlock account (Admin only)
-- =============================================

CREATE OR REPLACE FUNCTION public.unlock_account(
  user_email TEXT,
  admin_email TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_admin_user BOOLEAN;
  result JSON;
BEGIN
  -- Check if the requester is admin
  SELECT is_admin INTO is_admin_user
  FROM public.users
  WHERE email = admin_email;
  
  IF is_admin_user IS NULL OR is_admin_user = FALSE THEN
    result := json_build_object(
      'success', false,
      'message', 'Bạn không có quyền mở khóa tài khoản'
    );
    RETURN result;
  END IF;
  
  -- Unlock the account
  UPDATE public.users
  SET is_locked = FALSE,
      locked_at = NULL,
      locked_reason = NULL
  WHERE email = user_email;
  
  -- Clear failed login attempts
  DELETE FROM public.login_attempts
  WHERE email = user_email;
  
  result := json_build_object(
    'success', true,
    'message', 'Đã mở khóa tài khoản thành công'
  );
  RETURN result;
END;
$$;

-- =============================================
-- Function to get all locked accounts (Admin only)
-- =============================================

CREATE OR REPLACE FUNCTION public.get_locked_accounts(admin_email TEXT)
RETURNS TABLE (
  email TEXT,
  name TEXT,
  department TEXT,
  locked_at TIMESTAMPTZ,
  locked_reason TEXT,
  failed_attempts BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_admin_user BOOLEAN;
BEGIN
  -- Check if the requester is admin
  SELECT is_admin INTO is_admin_user
  FROM public.users
  WHERE users.email = admin_email;
  
  IF is_admin_user IS NULL OR is_admin_user = FALSE THEN
    RAISE EXCEPTION 'Bạn không có quyền xem danh sách tài khoản bị khóa';
  END IF;
  
  -- Return locked accounts with failed attempts count
  RETURN QUERY
  SELECT 
    u.email,
    u.name,
    u.department,
    u.locked_at,
    u.locked_reason,
    COUNT(la.id) as failed_attempts
  FROM public.users u
  LEFT JOIN public.login_attempts la ON u.email = la.email
  WHERE u.is_locked = TRUE
  GROUP BY u.email, u.name, u.department, u.locked_at, u.locked_reason
  ORDER BY u.locked_at DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.unlock_account(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_locked_accounts(TEXT) TO authenticated;

-- Add comments
COMMENT ON COLUMN public.users.is_locked IS 'Whether the account is locked';
COMMENT ON COLUMN public.users.locked_at IS 'When the account was locked';
COMMENT ON COLUMN public.users.locked_reason IS 'Reason for locking the account';
COMMENT ON COLUMN public.users.is_admin IS 'Whether the user is an admin';
COMMENT ON FUNCTION public.unlock_account(TEXT, TEXT) IS 'Unlocks a user account (Admin only)';
COMMENT ON FUNCTION public.get_locked_accounts(TEXT) IS 'Gets all locked accounts (Admin only)';
