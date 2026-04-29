-- Check kimnhi@krugervn.com account

-- 1. Check public.users
SELECT 
  'public.users' as table_name,
  id, 
  email, 
  name, 
  department, 
  access_role, 
  form_access, 
  is_locked, 
  is_admin,
  created_at
FROM public.users
WHERE email = 'kimnhi@krugervn.com';

-- 2. Check login_attempts
SELECT 
  'login_attempts' as table_name,
  COUNT(*) as failed_attempts,
  MAX(attempt_time) as last_attempt
FROM public.login_attempts
WHERE email = 'kimnhi@krugervn.com'
AND attempt_time > NOW() - INTERVAL '1 hour';

-- 3. Check all login attempts
SELECT 
  'all_attempts' as table_name,
  attempt_time,
  ip_address
FROM public.login_attempts
WHERE email = 'kimnhi@krugervn.com'
ORDER BY attempt_time DESC
LIMIT 5;
