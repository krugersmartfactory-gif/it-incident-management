-- =============================================
-- Function to confirm user email (Admin only)
-- =============================================

CREATE OR REPLACE FUNCTION public.confirm_user_email(
  user_email TEXT,
  admin_email TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_admin_user BOOLEAN;
  user_id UUID;
  result JSON;
BEGIN
  -- Check if the requester is admin
  SELECT is_admin INTO is_admin_user
  FROM public.users
  WHERE email = admin_email;
  
  IF is_admin_user IS NULL OR is_admin_user = FALSE THEN
    result := json_build_object(
      'success', false,
      'message', 'Bạn không có quyền confirm email'
    );
    RETURN result;
  END IF;
  
  -- Get user ID from auth.users
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = user_email;
  
  IF user_id IS NULL THEN
    result := json_build_object(
      'success', false,
      'message', 'Không tìm thấy user với email này'
    );
    RETURN result;
  END IF;
  
  -- Confirm email
  UPDATE auth.users
  SET email_confirmed_at = NOW()
  WHERE email = user_email
  AND email_confirmed_at IS NULL;
  
  result := json_build_object(
    'success', true,
    'message', 'Đã confirm email thành công'
  );
  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.confirm_user_email(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_user_email(TEXT, TEXT) TO anon;

-- Add comment
COMMENT ON FUNCTION public.confirm_user_email(TEXT, TEXT) IS 'Confirms user email (Admin only)';
