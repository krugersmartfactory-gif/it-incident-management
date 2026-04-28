# 📊 SƠ ĐỒ VÀ LUỒNG DỮ LIỆU HỆ THỐNG IT INCIDENT MANAGEMENT

## 1. KIẾN TRÚC TỔNG QUAN

```
┌─────────────────────────────────────────────────────────────┐
│                    NGƯỜI DÙNG (Users)                        │
│  - Người dùng thông thường (báo hỏng)                       │
│  - IT Staff (xử lý sự cố)                                   │
│  - Manager (quản lý, đánh giá)                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              GIAO DIỆN NGƯỜI DÙNG (Frontend)                 │
│                     index.html                               │
│  - Device Info Page (Quét QR)                               │
│  - Login Page                                                │
│  - Main App (Báo hỏng, Xử lý, Đánh giá)                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           BACKEND LOGIC (Google Apps Script)                 │
│                      Code.gs                                 │
│  - Authentication (loginUser, validateSession)              │
│  - Device Management (getDeviceList, getRepairCount)        │
│  - Incident Management (submitIncident, resolveIncident)    │
│  - Rating System (rateIncident)                             │
│  - Email Queue (processEmailQueue)                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              CƠ SỞ DỮ LIỆU (Google Sheets)                  │
│  - Sheet "user" (Thông tin người dùng)                     │
│  - Sheet "device" (Danh sách thiết bị)                     │
│  - Sheet "Incident Log" (Lịch sử sự cố)                    │
│  - Sheet "email_queue" (Hàng đợi email)                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              HỆ THỐNG EMAIL (Gmail API)                      │
│  - Gửi email xác nhận báo hỏng                             │
│  - Gửi email thông báo xử lý xong                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. LUỒNG DỮ LIỆU CHI TIẾT

### A. LUỒNG ĐĂNG NHẬP

```
[User] → Nhập Email + Password
   ↓
[Frontend] → handleLogin() → google.script.run.loginUser()
   ↓
[Backend] → Code.gs: loginUser(email, password)
   ↓
[Database] → Đọc Sheet "user", tìm user theo email
   ↓
[Backend] → Kiểm tra password (MD5 hash)
   ↓
   ├─ Đúng → Tạo session token (UUID)
   │          Lưu vào Sheet "user" (cột E)
   │          Trả về: {success: true, token, userName, department, formAccess}
   │          ↓
   │      [Frontend] → Lưu vào sessionStorage
   │                   Hiển thị Main App theo quyền
   │
   └─ Sai → Trả về: {success: false, error: "Sai email hoặc mật khẩu"}
             ↓
         [Frontend] → Hiển thị thông báo lỗi
```

---

### B. LUỒNG QUÉT MÃ QR VÀ XEM THÔNG TIN THIẾT BỊ

```
[User] → Quét mã QR trên thiết bị
   ↓
[Browser] → Mở URL: https://...?id=TN141
   ↓
[Frontend] → init() → google.script.url.getLocation()
   ↓
   Lấy deviceCode từ URL parameter (?id=TN141)
   ↓
   Hiển thị Device Info Page (loading state)
   ↓
[Frontend] → google.script.run.getDeviceList()
   ↓
[Backend] → Code.gs: getDeviceList()
   ↓
[Database] → Đọc Sheet "device", lấy tất cả thiết bị
   ↓
[Backend] → Trả về: {success: true, devices: [...]}
   ↓
[Frontend] → Tìm device theo deviceCode
             Lưu vào sessionStorage
             Hiển thị thông tin: Mã, Tên, Bộ phận, Ngày mua, Tuổi
   ↓
[Frontend] → google.script.run.getRepairCount(deviceCode)
   ↓
[Backend] → Code.gs: getRepairCount(deviceCode)
   ↓
[Database] → Đọc Sheet "Incident Log"
             Đếm số sự cố của thiết bị (cột B = deviceCode)
   ↓
[Backend] → Trả về: {success: true, count: 6}
   ↓
[Frontend] → Hiển thị "Lần sửa chữa: 6 lần"
```

---

### C. LUỒNG BÁO HỎNG THIẾT BỊ

```
[User] → Nhấn "Đăng nhập ngay" → Đăng nhập thành công
   ↓
[Frontend] → Chuyển sang Main App → Tab "Báo hỏng"
             Tự động điền: deviceCode, deviceName, userName, department
   ↓
[User] → Nhập: Mô tả sự cố, Mức độ
         Nhấn "Gửi báo hỏng"
   ↓
[Frontend] → handleReportSubmit() → google.script.run.submitIncident(data, token)
   ↓
[Backend] → Code.gs: submitIncident(data, sessionToken)
   ↓
   Kiểm tra session token (validateSession)
   ↓
   Tạo mã sự cố: INC-YYYY-XXX
   ↓
[Database] → Ghi vào Sheet "Incident Log":
             - Cột A: Incident Code (INC-20250423-001)
             - Cột B: Device Code (TN141)
             - Cột C: Device Name
             - Cột D: User Name
             - Cột E: Department
             - Cột F: Description
             - Cột G: Severity
             - Cột H: Report Date
             - Cột I: Status ("Open")
   ↓
[Backend] → Tạo email xác nhận
             Ghi vào Sheet "email_queue":
             - Cột A: Timestamp
             - Cột B: To (email người báo)
             - Cột C: Subject
             - Cột D: Body
             - Cột E: Status ("pending")
   ↓
[Backend] → Trả về: {success: true, incidentCode: "INC-20250423-001"}
   ↓
[Frontend] → Hiển thị thông báo thành công
             Ẩn form, hiện nút "Báo hỏng mới"
   ↓
[Trigger] → processEmailQueue() (chạy mỗi 1 phút)
   ↓
[Backend] → Đọc email_queue, lấy email "pending"
             Gửi email qua MailApp.sendEmail()
             Cập nhật status = "sent"
   ↓
[User] → Nhận email xác nhận trong hộp thư
```

---

### D. LUỒNG XỬ LÝ SỰ CỐ

```
[IT Staff] → Đăng nhập → Tab "Xử lý sự cố"
   ↓
[Frontend] → google.script.run.getOpenIncidents(token)
   ↓
[Backend] → Code.gs: getOpenIncidents(sessionToken)
   ↓
   Kiểm tra session token
   ↓
[Database] → Đọc Sheet "Incident Log"
             Lọc các sự cố có Status = "Open"
   ↓
[Backend] → Trả về: {success: true, incidents: [...]}
   ↓
[Frontend] → Hiển thị bảng danh sách sự cố
             Mỗi sự cố có nút "Xử lý"
   ↓
[IT Staff] → Nhấn nút "Xử lý" trên sự cố INC-20250423-001
   ↓
[Frontend] → Hiển thị form xử lý
             Tự động điền: Người xử lý = userName
   ↓
[IT Staff] → Nhập: Kết quả xử lý, Nguyên nhân gốc rễ
             Nhấn "Hoàn thành xử lý"
   ↓
[Frontend] → handleResolveSubmit() → google.script.run.resolveIncident(code, data, token)
   ↓
[Backend] → Code.gs: resolveIncident(incidentCode, resolutionData, sessionToken)
   ↓
   Kiểm tra session token
   ↓
[Database] → Tìm sự cố trong Sheet "Incident Log" (cột A = incidentCode)
             Cập nhật:
             - Cột J: Resolver (Người xử lý)
             - Cột K: Resolution (Kết quả)
             - Cột L: Root Cause (Nguyên nhân)
             - Cột M: Resolve Date (Ngày xử lý)
             - Cột I: Status = "Resolved"
   ↓
[Backend] → Tạo email thông báo xử lý xong
             Ghi vào Sheet "email_queue"
   ↓
[Backend] → Trả về: {success: true, incidentCode: "INC-20250423-001"}
   ↓
[Frontend] → Hiển thị thông báo thành công
             Ẩn form xử lý
             Reload danh sách sự cố
   ↓
[Trigger] → processEmailQueue()
   ↓
[Backend] → Gửi email thông báo cho người báo hỏng
   ↓
[User] → Nhận email "Sự cố đã được xử lý"
```

---

### E. LUỒNG ĐÁNH GIÁ CHẤT LƯỢNG

```
[User] → Đăng nhập → Tab "Đánh giá"
   ↓
[Frontend] → google.script.run.getUnratedIncidentsByDevice(deviceCode)
   ↓
[Backend] → Code.gs: getUnratedIncidentsByDevice(deviceCode)
   ↓
[Database] → Đọc Sheet "Incident Log"
             Lọc: Device Code = deviceCode
                  Status = "Resolved"
                  Rating = "" (chưa đánh giá)
   ↓
[Backend] → Trả về: {success: true, incidents: [...]}
   ↓
[Frontend] → Hiển thị danh sách sự cố chưa đánh giá
   ↓
[User] → Nhấn vào sự cố → Tự động điền Mã sự cố
         Chọn số sao (1-5)
         Nhập nhận xét thái độ (optional)
         Nhấn "Gửi đánh giá"
   ↓
[Frontend] → handleRateSubmit() → google.script.run.rateIncident(code, rating, rater, comment, token)
   ↓
[Backend] → Code.gs: rateIncident(incidentCode, rating, raterName, attitudeComment, sessionToken)
   ↓
   Kiểm tra session token
   ↓
[Database] → Tìm sự cố trong Sheet "Incident Log"
             Cập nhật:
             - Cột N: Rating (1-5)
             - Cột O: Rater Name
             - Cột P: Attitude Comment (Nhận xét thái độ)
   ↓
[Backend] → Trả về: {success: true}
   ↓
[Frontend] → Hiển thị thông báo thành công
             Reset form
             Reload danh sách sự cố chưa đánh giá
```

---

### F. LUỒNG ĐỔI MẬT KHẨU

```
[User] → Nhấn "🔑 Đổi mật khẩu"
   ↓
[Frontend] → Hiển thị modal đổi mật khẩu
   ↓
[User] → Nhập: Mật khẩu cũ, Mật khẩu mới, Xác nhận mật khẩu
         Nhấn "Đổi mật khẩu"
   ↓
[Frontend] → Kiểm tra: newPassword === confirmPassword
             Kiểm tra: newPassword.length >= 6
             ↓
             google.script.run.changePassword(email, oldPass, newPass, token)
   ↓
[Backend] → Code.gs: changePassword(email, oldPassword, newPassword, sessionToken)
   ↓
   Kiểm tra session token
   ↓
[Database] → Tìm user trong Sheet "user" (cột A = email)
             Kiểm tra mật khẩu cũ (MD5 hash)
   ↓
   ├─ Đúng → Hash mật khẩu mới (MD5)
   │          Cập nhật:
   │          - Cột D: Password (hash mới)
   │          - Cột G: password_last_changed (timestamp)
   │          ↓
   │      [Backend] → Trả về: {success: true}
   │          ↓
   │      [Frontend] → Hiển thị "Đổi mật khẩu thành công"
   │                   Đóng modal sau 2 giây
   │
   └─ Sai → Trả về: {success: false, error: "Mật khẩu cũ không đúng"}
             ↓
         [Frontend] → Hiển thị thông báo lỗi
```

---

## 3. CẤU TRÚC DỮ LIỆU GOOGLE SHEETS

### Sheet "user"
```
| A (email) | B (name) | C (department) | D (password) | E (session_token) | F (Access Role) | G (password_last_changed) | H (FormAccess) |
|-----------|----------|----------------|--------------|-------------------|-----------------|---------------------------|----------------|
| user@...  | Nguyễn A | IT             | md5hash...   | uuid-token...     | user            | 2026-04-23 10:00:00       | báo hỏng       |
| it@...    | Trần B   | IT             | md5hash...   | uuid-token...     | manager         | 2026-04-20 09:00:00       | báo hỏng, xử lý, đánh giá |
```

### Sheet "device"
```
| A (code) | B (name)              | C (department) | D (purchaseDate) | E (status) |
|----------|-----------------------|----------------|------------------|------------|
| TN141    | lap top Dell...       | IT             | 01/10/2025       | Active     |
| TN142    | Màn hình Dell 24"     | HR             | 15/03/2025       | Active     |
```

### Sheet "Incident Log"
```
| A (Incident Code) | B (Device Code) | C (Device Name) | D (User Name) | E (Department) | F (Description) | G (Severity) | H (Report Date) | I (Status) | J (Resolver) | K (Resolution) | L (Root Cause) | M (Resolve Date) | N (Rating) | O (Rater Name) | P (Attitude Comment) |
|-------------------|-----------------|-----------------|---------------|----------------|-----------------|--------------|-----------------|------------|--------------|----------------|----------------|------------------|------------|----------------|----------------------|
| INC-20250423-001  | TN141           | lap top Dell... | Nguyễn A      | IT             | Máy không khởi động | Cao      | 23/04/2026 10:30 | Resolved   | Trần B       | Đã thay nguồn  | Nguồn hỏng     | 23/04/2026 14:30 | 5          | Nguyễn A       | Nhiệt tình, tốt      |
```

### Sheet "email_queue"
```
| A (timestamp) | B (to) | C (subject) | D (body) | E (status) |
|---------------|--------|-------------|----------|------------|
| 2026-04-23... | user@..| [IT Incident]...| Email body...| sent |
| 2026-04-23... | user@..| [IT Incident]...| Email body...| pending |
```

---

## 4. PHÂN QUYỀN NGƯỜI DÙNG

```
┌─────────────────────────────────────────────────────────────┐
│                    PHÂN QUYỀN HỆ THỐNG                       │
└─────────────────────────────────────────────────────────────┘

FormAccess (Cột H trong Sheet "user"):
├─ "báo hỏng" → Chỉ thấy tab "Báo hỏng"
├─ "xử lý" → Chỉ thấy tab "Xử lý sự cố"
├─ "đánh giá" → Chỉ thấy tab "Đánh giá"
└─ "báo hỏng, xử lý, đánh giá" → Thấy tất cả tabs

Access Role (Cột F trong Sheet "user"):
├─ "user" → Người dùng thông thường
└─ "manager" → Quản lý (có thể có thêm quyền trong tương lai)
```

---

## 5. HỆ THỐNG EMAIL TỰ ĐỘNG

```
┌─────────────────────────────────────────────────────────────┐
│              LUỒNG XỬ LÝ EMAIL TỰ ĐỘNG                       │
└─────────────────────────────────────────────────────────────┘

[Event] → Báo hỏng / Xử lý xong
   ↓
[Backend] → Tạo email content
             Ghi vào Sheet "email_queue"
             Status = "pending"
   ↓
[Trigger] → Time-driven trigger (mỗi 1 phút)
             Chạy function: processEmailQueue()
   ↓
[Backend] → Đọc Sheet "email_queue"
             Lọc status = "pending"
             Giới hạn 10 email/lần
   ↓
   Với mỗi email:
   ├─ Gửi qua MailApp.sendEmail(to, subject, body)
   ├─ Cập nhật status = "sent"
   └─ Log kết quả
   ↓
[Gmail] → Gửi email đến người nhận
   ↓
[User] → Nhận email trong hộp thư
```

---

## 6. BẢO MẬT VÀ SESSION

```
┌─────────────────────────────────────────────────────────────┐
│                  QUẢN LÝ SESSION TOKEN                        │
└─────────────────────────────────────────────────────────────┘

Đăng nhập:
├─ Tạo UUID token (Utilities.getUuid())
├─ Lưu vào Sheet "user" cột E (session_token)
└─ Trả về token cho Frontend

Frontend:
├─ Lưu token vào sessionStorage
└─ Gửi token với mọi request đến Backend

Backend:
├─ Nhận token từ request
├─ Gọi validateSession(token)
├─ Tìm user có session_token = token
└─ Trả về thông tin user nếu hợp lệ

Đăng xuất:
├─ Frontend: sessionStorage.clear()
└─ Token vẫn còn trong database (có thể xóa nếu cần)

Mật khẩu:
├─ Hash bằng MD5 (Utilities.computeDigest)
├─ Không lưu plain text
└─ So sánh hash khi đăng nhập
```

---

## 7. SƠ ĐỒ TỔNG QUAN LUỒNG HOẠT ĐỘNG

```
┌──────────────────────────────────────────────────────────────────────┐
│                     LUỒNG HOẠT ĐỘNG TỔNG QUAN                         │
└──────────────────────────────────────────────────────────────────────┘

1. QUÉT QR CODE
   User quét QR → Device Info Page → Đăng nhập → Main App

2. BÁO HỎNG
   User điền form → Submit → Lưu DB → Tạo email → Gửi email

3. XỬ LÝ
   IT Staff xem danh sách → Chọn sự cố → Xử lý → Lưu DB → Gửi email

4. ĐÁNH GIÁ
   User xem danh sách → Chọn sự cố → Đánh giá → Lưu DB

5. EMAIL TỰ ĐỘNG
   Trigger (1 phút) → Đọc queue → Gửi email → Cập nhật status
```

---

**© 2026 IT Incident Management System**
