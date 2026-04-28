# Hướng dẫn Admin mở khóa tài khoản

## 1. Cấp quyền Admin cho tài khoản

Chạy SQL sau trong Supabase SQL Editor để cấp quyền Admin:

```sql
-- Cấp quyền Admin cho email cụ thể
UPDATE public.users
SET is_admin = TRUE
WHERE email = 'admin@krugervn.com'; -- Thay bằng email Admin của bạn
```

## 2. Xem danh sách tài khoản bị khóa

### Cách 1: Sử dụng SQL trực tiếp

```sql
-- Xem tất cả tài khoản bị khóa
SELECT 
  email,
  name,
  department,
  locked_at,
  locked_reason,
  is_locked
FROM public.users
WHERE is_locked = TRUE
ORDER BY locked_at DESC;
```

### Cách 2: Sử dụng Function (từ Frontend)

```javascript
// Gọi function từ JavaScript
const { data, error } = await supabaseClient
  .rpc('get_locked_accounts', { 
    admin_email: 'admin@krugervn.com' 
  });

console.log('Locked accounts:', data);
```

## 3. Mở khóa tài khoản

### Cách 1: Sử dụng SQL trực tiếp (Nhanh nhất)

```sql
-- Mở khóa tài khoản cụ thể
UPDATE public.users
SET is_locked = FALSE,
    locked_at = NULL,
    locked_reason = NULL
WHERE email = 'user@krugervn.com'; -- Email cần mở khóa

-- Xóa lịch sử đăng nhập sai
DELETE FROM public.login_attempts
WHERE email = 'user@krugervn.com';
```

### Cách 2: Sử dụng Function (từ Frontend)

```javascript
// Gọi function từ JavaScript
const { data, error } = await supabaseClient
  .rpc('unlock_account', { 
    user_email: 'user@krugervn.com',  // Email cần mở khóa
    admin_email: 'admin@krugervn.com' // Email Admin
  });

if (data.success) {
  console.log('✅', data.message);
} else {
  console.error('❌', data.message);
}
```

## 4. Kiểm tra trạng thái tài khoản

```sql
-- Kiểm tra tài khoản có bị khóa không
SELECT 
  email,
  name,
  is_locked,
  locked_at,
  locked_reason,
  is_admin
FROM public.users
WHERE email = 'user@krugervn.com';
```

## 5. Xem lịch sử đăng nhập sai

```sql
-- Xem lịch sử đăng nhập sai của tài khoản
SELECT 
  email,
  attempt_time,
  ip_address,
  user_agent
FROM public.login_attempts
WHERE email = 'user@krugervn.com'
ORDER BY attempt_time DESC;
```

## 6. Xóa toàn bộ lịch sử đăng nhập sai

```sql
-- Xóa tất cả lịch sử đăng nhập sai (Reset hệ thống)
DELETE FROM public.login_attempts;
```

## 7. Thống kê tài khoản bị khóa

```sql
-- Đếm số tài khoản bị khóa
SELECT COUNT(*) as total_locked
FROM public.users
WHERE is_locked = TRUE;

-- Thống kê theo bộ phận
SELECT 
  department,
  COUNT(*) as locked_count
FROM public.users
WHERE is_locked = TRUE
GROUP BY department
ORDER BY locked_count DESC;
```

## Lưu ý quan trọng

⚠️ **Chỉ Admin mới có quyền:**
- Xem danh sách tài khoản bị khóa
- Mở khóa tài khoản

⚠️ **Tài khoản bị khóa khi:**
- Đăng nhập sai 3 lần liên tiếp
- Khóa vĩnh viễn (không tự động mở)
- Chỉ Admin mới có thể mở khóa

⚠️ **Khuyến nghị:**
- Cấp quyền Admin cho ít nhất 2 tài khoản
- Lưu email Admin ở nơi an toàn
- Định kỳ kiểm tra danh sách tài khoản bị khóa
