# IT Incident Management System

Hệ thống quản lý sự cố IT với Supabase backend.

## Tính năng

- ✅ Đăng nhập với khóa tài khoản sau 3 lần sai mật khẩu
- ✅ Báo hỏng thiết bị
- ✅ Xử lý sự cố
- ✅ Đánh giá chất lượng xử lý
- ✅ Quản trị (Admin): Mở khóa tài khoản
- ✅ Quét mã QR để báo hỏng nhanh
- ✅ Phân quyền form theo user

## Cài đặt

### 1. Clone repository

```bash
git clone https://github.com/YOUR_USERNAME/it-incident-management.git
cd it-incident-management
```

### 2. Cấu hình Supabase

Copy file cấu hình mẫu:

```bash
cp config.example.js config.js
```

Mở `config.js` và điền thông tin Supabase của bạn:

```javascript
const SUPABASE_CONFIG = {
  url: 'YOUR_SUPABASE_URL',
  anonKey: 'YOUR_SUPABASE_ANON_KEY'
};
```

### 3. Chạy migrations

Mở Supabase SQL Editor và chạy các file migration theo thứ tự:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_create_generate_incident_code_function.sql`
3. `supabase/migrations/003_create_login_attempts_table.sql`
4. `supabase/migrations/004_add_account_lock_feature.sql`
5. `supabase/migrations/005_fix_account_lock_logic.sql`

### 4. Migration Auth users (Tùy chọn)

Nếu bạn đã có dữ liệu users trong Google Sheets:

```bash
npm install
node migrate-auth-users.js
```

### 5. Mở file HTML

Mở `index-supabase-v2.html` trong trình duyệt hoặc deploy lên hosting.

## Deploy lên Internet

Xem hướng dẫn chi tiết trong file `DEPLOY_GUIDE.md`.

**Khuyến nghị:** Netlify (miễn phí, đơn giản)

## Tạo mã QR cho thiết bị

Sau khi deploy, tạo mã QR với định dạng:

```
https://yoursite.com/?device=MA_THIET_BI
```

Ví dụ:
- `https://yoursite.com/?device=PC001`
- `https://yoursite.com/?device=PRINTER-02`

Dùng công cụ: https://www.qr-code-generator.com/

## Cấu trúc thư mục

```
.
├── index-supabase-v2.html    # File HTML chính
├── config.js                  # Cấu hình Supabase (không commit)
├── config.example.js          # Mẫu cấu hình
├── migrate-auth-users.js      # Script migration users
├── supabase/
│   └── migrations/            # SQL migrations
├── DEPLOY_GUIDE.md            # Hướng dẫn deploy
└── README.md                  # File này
```

## Bảo mật

- ⚠️ **KHÔNG commit file `config.js`** lên GitHub
- ✅ File `.gitignore` đã được cấu hình để bỏ qua file nhạy cảm
- ✅ Chỉ sử dụng **Anon Key** (public key), không dùng Service Role Key

## Hỗ trợ

Nếu gặp vấn đề, tạo issue trên GitHub hoặc liên hệ admin.

## License

MIT License
