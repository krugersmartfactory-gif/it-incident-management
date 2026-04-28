# Hướng dẫn Migration sang Supabase

## Tổng quan

File `index-supabase.html` là phiên bản mới của hệ thống IT Incident Management, đã được migration từ Google Apps Script + Google Sheets sang Supabase.

## Các thay đổi chính

### 1. Backend
- **Trước**: Google Apps Script + Google Sheets
- **Sau**: Supabase (PostgreSQL + Auth + Edge Functions)

### 2. Authentication
- **Trước**: Custom session management với CacheService
- **Sau**: Supabase Auth với JWT tokens
- Auto token refresh
- Secure password management

### 3. Database
- **Trước**: Google Sheets (4 sheets)
- **Sau**: PostgreSQL với 4 tables:
  - `users` - Thông tin người dùng
  - `devices` - Danh sách thiết bị
  - `incidents` - Log sự cố
  - `email_queue` - Hàng đợi email

### 4. Security
- **Trước**: Application-level authorization
- **Sau**: Row Level Security (RLS) policies tại database level

## Các tính năng đã implement

### ✅ Authentication (Tasks 5.1, 5.2)
- [x] Supabase JS Client initialization
- [x] Login với email/password
- [x] Logout
- [x] Session validation
- [x] Password change
- [x] Auto token refresh
- [x] Device login (QR code flow)

### ✅ Authorization (Task 5.3)
- [x] Fetch user profile sau login
- [x] Store permissions trong sessionStorage
- [x] Apply form access permissions (ẩn/hiện tabs)

### ✅ Device Management (Task 5.4)
- [x] Load device info từ QR code (?id=deviceCode)
- [x] Case-insensitive device code lookup
- [x] Calculate device age
- [x] Count repair history
- [x] Device caching trong sessionStorage

### ✅ Incident Operations (Tasks 5.5, 5.6, 5.7)
- [x] Submit incident với auto-generated code
- [x] Load open incidents
- [x] Resolve incident
- [x] Load unrated incidents
- [x] Rate incident với star rating

### ✅ Email Queue (Task 5.8)
- [x] Enqueue incident notification email
- [x] Enqueue resolution notification email
- [x] Build HTML email content

### ✅ Error Handling (Task 5.9)
- [x] Centralized error handler
- [x] Map Supabase error codes sang tiếng Việt
- [x] User-friendly error messages

## Cấu trúc file

```
index-supabase.html
├── HTML Structure (giữ nguyên 100% từ index.html)
├── CSS Styles (giữ nguyên 100%)
└── JavaScript
    ├── Supabase Configuration
    ├── Global Variables
    ├── Error Handling
    ├── Authentication Functions
    ├── Device Management Functions
    ├── Incident Operations
    ├── Email Queue Functions
    ├── UI Helper Functions
    └── Initialization
```

## API Mapping

| Google Apps Script | Supabase |
|-------------------|----------|
| `loginUser()` | `supabase.auth.signInWithPassword()` |
| `validateSession()` | `supabase.auth.getSession()` |
| `changePassword()` | `supabase.auth.updateUser()` |
| `getDeviceList()` | `supabase.from('devices').select()` |
| `submitIncident()` | `supabase.from('incidents').insert()` + `supabase.rpc('generate_incident_code')` |
| `getOpenIncidents()` | `supabase.from('incidents').select().eq('status', 'Open')` |
| `resolveIncident()` | `supabase.from('incidents').update()` |
| `getUnratedIncidentsByDevice()` | `supabase.from('incidents').select().is('rating', null)` |
| `rateIncident()` | `supabase.from('incidents').update()` |

## Các bước triển khai

### 1. Setup Database (Đã hoàn thành)
- ✅ Tạo tables trong Supabase
- ✅ Tạo RLS policies
- ✅ Tạo database functions
- ✅ Tạo indexes

### 2. Migrate Data (Cần thực hiện)
- [ ] Export data từ Google Sheets
- [ ] Transform data format
- [ ] Import vào Supabase
- [ ] Verify data integrity

### 3. Deploy Frontend (Cần thực hiện)
- [ ] Test `index-supabase.html` trên local
- [ ] Deploy lên hosting (hoặc update Google Apps Script)
- [ ] Update QR code URLs (nếu cần)

### 4. Setup Email Service (Cần thực hiện)
- [ ] Tạo Supabase Edge Function cho email processor
- [ ] Configure SMTP service (SendGrid/Resend)
- [ ] Setup scheduled trigger (pg_cron hoặc GitHub Actions)

### 5. Testing (Cần thực hiện)
- [ ] Test authentication flow
- [ ] Test QR code scanning
- [ ] Test incident submission
- [ ] Test incident resolution
- [ ] Test incident rating
- [ ] Test email notifications

## Backward Compatibility

### QR Code URLs
- ✅ Giữ nguyên format: `?id=TN141`
- ✅ Case-insensitive device code lookup
- ✅ Không cần in lại QR codes

### UI/UX
- ✅ Giữ nguyên 100% HTML structure
- ✅ Giữ nguyên 100% CSS styles
- ✅ Giữ nguyên user workflows

### Data Format
- ✅ Incident code format: `INC-YYYY-XXX`
- ✅ Date formats: ISO 8601
- ✅ Severity values: "Cao", "Trung bình", "Thấp"

## Lưu ý quan trọng

### 1. Environment Variables
File hiện tại có hardcode Supabase credentials:
```javascript
const SUPABASE_URL = 'https://vjudueltlidywypsktwk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGci...';
```

**Lưu ý**: Anon Key là public key, an toàn để expose trong frontend. Service Role Key KHÔNG được expose.

### 2. Database Functions
Cần đảm bảo các functions sau đã được tạo trong Supabase:
- `generate_incident_code()` - Tạo mã sự cố unique
- `calculate_device_age_months()` - Tính tuổi thiết bị
- `count_device_repairs()` - Đếm số lần sửa chữa

### 3. RLS Policies
Đảm bảo RLS policies đã được enable và configure đúng:
- Users: Chỉ đọc được record của mình
- Devices: Authenticated users đọc được tất cả
- Incidents: Read all, insert all, update theo permission
- Email Queue: Chỉ service role

### 4. Email Processing
Email queue cần Edge Function để process. Có 3 options:
1. **pg_cron** (recommended): Schedule trong Supabase
2. **GitHub Actions**: Workflow chạy mỗi 1 phút
3. **Webhook**: Trigger từ frontend sau mỗi incident

## Testing Checklist

### Authentication
- [ ] Login với valid credentials
- [ ] Login với invalid credentials
- [ ] Logout
- [ ] Session persistence (reload page)
- [ ] Password change
- [ ] Device login từ QR code

### Device Management
- [ ] Scan QR code → hiển thị device info
- [ ] Device age calculation
- [ ] Repair count
- [ ] Case-insensitive device code

### Incident Lifecycle
- [ ] Submit incident → nhận mã sự cố
- [ ] View open incidents
- [ ] Resolve incident
- [ ] View unrated incidents
- [ ] Rate incident

### Permissions
- [ ] User với "báo hỏng" → chỉ thấy tab Báo hỏng
- [ ] User với "xử lý" → chỉ thấy tab Xử lý
- [ ] User với "đánh giá" → chỉ thấy tab Đánh giá
- [ ] User với full access → thấy tất cả tabs

### Email
- [ ] Incident email được enqueue
- [ ] Resolution email được enqueue
- [ ] Email HTML format đúng

## Troubleshooting

### Lỗi "Invalid login credentials"
- Kiểm tra user đã được tạo trong Supabase Auth
- Kiểm tra password đúng
- Kiểm tra email đã được confirm

### Lỗi "Permission denied"
- Kiểm tra RLS policies
- Kiểm tra user đã login
- Kiểm tra JWT token còn valid

### Lỗi "Function not found"
- Kiểm tra database functions đã được tạo
- Kiểm tra function name đúng
- Kiểm tra function permissions

### Device không load được
- Kiểm tra device code tồn tại trong database
- Kiểm tra case-insensitive lookup
- Kiểm tra RLS policy cho devices table

## Next Steps

1. **Immediate**:
   - Test file `index-supabase.html` trên local
   - Verify tất cả functions hoạt động đúng

2. **Short-term**:
   - Migrate data từ Google Sheets
   - Setup email Edge Function
   - Deploy lên staging environment

3. **Long-term**:
   - User acceptance testing
   - Production deployment
   - Monitor và optimize performance

## Support

Nếu gặp vấn đề, kiểm tra:
1. Browser console logs
2. Supabase dashboard logs
3. Network tab (API calls)
4. RLS policies trong Supabase

## Changelog

### Version 1.0.0 (2025-01-24)
- ✅ Initial migration từ Google Apps Script sang Supabase
- ✅ Implement authentication với Supabase Auth
- ✅ Implement device management
- ✅ Implement incident operations
- ✅ Implement email queue
- ✅ Implement error handling
- ✅ Maintain 100% backward compatibility
