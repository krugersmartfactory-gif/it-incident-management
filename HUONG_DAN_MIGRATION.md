# Hướng dẫn Migration Supabase Auth Users

## 📋 Tổng quan

Script `migrate-auth-users.js` sẽ tự động:
1. Đọc tất cả users từ bảng `public.users`
2. Tạo Supabase Auth users với password tạm thời `123456`
3. Link UUID giữa `auth.users` và `public.users`

---

## 🚀 Cách sử dụng

### Bước 1: Cài đặt Node.js

Kiểm tra Node.js đã cài chưa:
```bash
node --version
```

Nếu chưa có, tải tại: https://nodejs.org/ (chọn LTS version)

---

### Bước 2: Cài đặt dependencies

Mở terminal trong thư mục project, chạy:

```bash
npm init -y
npm install @supabase/supabase-js
```

---

### Bước 3: Lấy Service Role Key

1. Vào **Supabase Dashboard**: https://supabase.com/dashboard
2. Chọn project của bạn
3. Vào **Settings** → **API**
4. Tìm phần **Project API keys**
5. Copy **service_role** key (secret) - **KHÔNG phải anon key!**

⚠️ **LƯU Ý**: Service Role Key rất quan trọng, KHÔNG share công khai!

---

### Bước 4: Cấu hình script

Mở file `migrate-auth-users.js`, tìm dòng:

```javascript
const SUPABASE_SERVICE_ROLE_KEY = 'YOUR_SERVICE_ROLE_KEY_HERE';
```

Thay `YOUR_SERVICE_ROLE_KEY_HERE` bằng Service Role Key vừa copy.

**Ví dụ:**
```javascript
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

---

### Bước 5: Chạy migration

```bash
node migrate-auth-users.js
```

Script sẽ:
- ✅ Đọc tất cả users từ database
- ✅ Tạo Auth users (skip nếu đã tồn tại)
- ✅ Update UUID vào bảng `users`
- ✅ Hiển thị kết quả

---

## 📊 Kết quả mong đợi

```
🚀 Bắt đầu migration Auth users...

📋 Đọc danh sách users từ database...
✅ Tìm thấy 138 users

📧 Xử lý: duom1988@gmail.com (Lê Văn Dượm)
   ✅ Đã tạo Auth user: a1b2c3d4-e5f6-7890-abcd-ef1234567890
   ✅ Đã link UUID vào bảng users

📧 Xử lý: kvn.quoctri@gmail.com (Cao Quốc Trí)
   ✅ Đã tạo Auth user: b2c3d4e5-f6a7-8901-bcde-f12345678901
   ✅ Đã link UUID vào bảng users

...

============================================================
📊 KẾT QUẢ MIGRATION:
============================================================
✅ Thành công: 136 users
⏭️  Đã tồn tại: 2 users
❌ Lỗi: 0 users
📧 Tổng cộng: 138 users
============================================================

🔑 THÔNG TIN ĐĂNG NHẬP:
   Email: <email từ danh sách>
   Password: 123456

⚠️  LƯU Ý: Yêu cầu users đổi password sau lần đăng nhập đầu tiên!

🔍 Kiểm tra kết quả migration...

📊 Bảng public.users: 138 users
🔐 Supabase Auth: 138 users

✅ Tất cả users đã có UUID!

✅ Migration hoàn tất!
```

---

## 🔧 Troubleshooting

### Lỗi: "Invalid API key"
- Kiểm tra lại Service Role Key
- Đảm bảo copy đúng key (không có khoảng trắng thừa)

### Lỗi: "User already registered"
- User đã tồn tại trong Auth
- Script sẽ tự động skip và update UUID

### Lỗi: "Permission denied"
- Kiểm tra RLS policies đã enable chưa
- Đảm bảo dùng Service Role Key (không phải Anon Key)

---

## ✅ Sau khi migration xong

### 1. Test login

Mở file `index-supabase.html` trong browser:
- Email: `duom1988@gmail.com` (hoặc email bất kỳ)
- Password: `123456`

### 2. Yêu cầu users đổi password

Gửi email cho tất cả users:
```
Chào bạn,

Hệ thống IT Incident Management đã được nâng cấp lên Supabase.

Thông tin đăng nhập:
- Email: <email của bạn>
- Password tạm thời: 123456

Vui lòng đăng nhập và đổi password ngay lập tức!

Link: <URL của index-supabase.html>
```

### 3. Verify data

Kiểm tra trong Supabase Dashboard:
- **Authentication** → **Users**: Xem danh sách Auth users
- **Table Editor** → **users**: Kiểm tra UUID đã được fill

---

## 🔐 Bảo mật

⚠️ **QUAN TRỌNG:**

1. **KHÔNG commit Service Role Key** vào Git
2. **Xóa Service Role Key** khỏi file sau khi migration xong
3. **Yêu cầu users đổi password** ngay sau lần đăng nhập đầu
4. **Backup database** trước khi chạy migration

---

## 📞 Hỗ trợ

Nếu gặp vấn đề, kiểm tra:
1. Node.js version >= 16
2. Service Role Key đúng
3. Internet connection
4. Supabase project đang hoạt động

---

## 🎯 Next Steps

Sau khi migration xong:
1. ✅ Test login với `index-supabase.html`
2. ✅ Import data cho `devices` và `incidents`
3. ✅ Setup email service (Edge Function)
4. ✅ Deploy production
