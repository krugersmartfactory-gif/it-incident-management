# Hướng dẫn Reset Mật khẩu (Admin)

## Tổng quan
Tính năng này cho phép Admin reset mật khẩu cho bất kỳ người dùng nào trong hệ thống, đặc biệt hữu ích khi người dùng quên mật khẩu hoặc tài khoản bị khóa.

---

## Bước 1: Chạy Migration SQL

### 1.1. Truy cập Supabase SQL Editor
1. Đăng nhập vào [Supabase Dashboard](https://supabase.com/dashboard)
2. Chọn project của bạn
3. Vào **SQL Editor** (biểu tượng 📝 ở sidebar bên trái)

### 1.2. Chạy Migration Script
1. Mở file `supabase/migrations/007_add_admin_reset_password.sql`
2. Copy toàn bộ nội dung
3. Paste vào SQL Editor
4. Click **Run** hoặc nhấn `Ctrl + Enter`

### 1.3. Kiểm tra kết quả
Bạn sẽ thấy thông báo:
```
Success. No rows returned
```

Điều này có nghĩa là function `admin_reset_password` đã được tạo thành công.

---

## Bước 2: Sử dụng chức năng Reset Password

### 2.1. Đăng nhập với tài khoản Admin
- Chỉ tài khoản có `is_admin = TRUE` trong bảng `users` mới có quyền reset mật khẩu
- Đăng nhập vào hệ thống với tài khoản Admin

### 2.2. Truy cập tab Quản trị
1. Sau khi đăng nhập, click vào tab **🔐 Quản trị**
2. Danh sách tài khoản bị khóa sẽ hiển thị (nếu có)

### 2.3. Reset mật khẩu
1. Tìm tài khoản cần reset mật khẩu trong bảng
2. Click nút **🔑 Reset MK** ở cột "Hành động"
3. Modal "Reset mật khẩu người dùng" sẽ hiển thị
4. Nhập mật khẩu mới (tối thiểu 6 ký tự)
5. Xác nhận mật khẩu mới
6. Click **Reset mật khẩu**

### 2.4. Thông báo kết quả
- ✅ **Thành công**: "Đã reset mật khẩu thành công cho: [email]"
- ❌ **Thất bại**: Hiển thị lỗi cụ thể (không có quyền, email không tồn tại, v.v.)

---

## Bước 3: Kiểm tra

### 3.1. Đăng xuất tài khoản Admin
- Click **Đăng xuất** ở góc trên bên phải

### 3.2. Đăng nhập với tài khoản đã reset
- Sử dụng email và mật khẩu mới vừa reset
- Nếu đăng nhập thành công → Reset password hoạt động đúng

---

## Lưu ý quan trọng

### ⚠️ Bảo mật
- **Chỉ Admin mới có quyền reset mật khẩu**
- Function `admin_reset_password` kiểm tra `is_admin = TRUE` trước khi thực hiện
- Nếu không phải Admin, sẽ nhận lỗi: "Bạn không có quyền reset mật khẩu"

### 🔐 Mật khẩu mới
- Mật khẩu mới phải có **tối thiểu 6 ký tự**
- Nên sử dụng mật khẩu mạnh (chữ hoa, chữ thường, số, ký tự đặc biệt)
- Thông báo cho người dùng về mật khẩu mới qua email hoặc điện thoại

### 📝 Ghi chú
- Chức năng này hoạt động cho cả tài khoản bị khóa và tài khoản bình thường
- Sau khi reset, người dùng nên đổi mật khẩu ngay lập tức bằng chức năng "Đổi mật khẩu"

---

## Xử lý lỗi thường gặp

### Lỗi: "Bạn không có quyền reset mật khẩu"
**Nguyên nhân**: Tài khoản đăng nhập không phải Admin

**Giải pháp**:
1. Kiểm tra cột `is_admin` trong bảng `users`
2. Cập nhật quyền Admin:
```sql
UPDATE public.users
SET is_admin = TRUE
WHERE email = 'admin@example.com';
```

### Lỗi: "Không tìm thấy tài khoản với email: [email]"
**Nguyên nhân**: Email không tồn tại trong hệ thống

**Giải pháp**:
- Kiểm tra lại email chính xác
- Kiểm tra bảng `auth.users` và `public.users`

### Lỗi: "Mật khẩu phải có ít nhất 6 ký tự"
**Nguyên nhân**: Mật khẩu mới quá ngắn

**Giải pháp**:
- Nhập mật khẩu có ít nhất 6 ký tự

---

## Cập nhật code lên GitHub và Vercel

### 1. Đẩy code lên GitHub
```bash
git add .
git commit -m "Add admin reset password feature"
git push origin main
```

### 2. Vercel tự động deploy
- Vercel sẽ tự động phát hiện thay đổi và deploy
- Không cần thao tác thủ công
- Kiểm tra tại: https://it-incident-management.vercel.app/

---

## Tóm tắt các thay đổi

### 1. Database (Supabase)
- ✅ Thêm function `admin_reset_password(user_email, new_password, admin_email)`
- ✅ Kiểm tra quyền Admin trước khi reset
- ✅ Validate mật khẩu mới (tối thiểu 6 ký tự)

### 2. Frontend (index.html)
- ✅ Xóa dòng cảnh báo "⚠️ Chức năng Admin: Chỉ tài khoản Admin..."
- ✅ Thêm nút "🔑 Reset MK" trong bảng tài khoản bị khóa
- ✅ Thêm modal "Reset mật khẩu người dùng"
- ✅ Thêm function `showResetPasswordModal()`, `hideResetPasswordModal()`, `handleResetPassword()`
- ✅ Thêm event listeners cho modal reset password

---

## Hỗ trợ

Nếu gặp vấn đề, vui lòng kiểm tra:
1. Migration SQL đã chạy thành công chưa
2. Tài khoản đăng nhập có `is_admin = TRUE` chưa
3. Console log trong trình duyệt (F12 → Console)
4. Supabase logs (Dashboard → Logs)
