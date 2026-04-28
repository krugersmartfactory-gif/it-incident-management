# Design Document — IT Incident Management System

## Overview

Hệ thống Quản lý Sự cố IT được xây dựng trên Google Apps Script Web App, sử dụng Google Spreadsheet làm backend lưu trữ dữ liệu. Kiến trúc gồm ba lớp: **Presentation** (HTML/CSS/JS phía client), **Application Logic** (Google Apps Script server-side), và **Data Layer** (Google Sheets).

---

## Architecture

```
Browser (Client)
  ├── index.html        — SPA chính (Login, Báo hỏng, Xử lý, Đánh giá)
  └── DeviceInfo.html   — Trang thông tin thiết bị công khai (QR scan)

Google Apps Script (Server)
  └── Code.gs           — Router + Auth + Device + Incident + Helper modules

Google Spreadsheet (Data)
  ├── Sheet: "Incident Log"         — Dữ liệu sự cố (16 cột)
  ├── Sheet: "danh sách thiết bị"   — Danh sách thiết bị IT
  └── Sheet: "user"                 — Tài khoản người dùng
```

### Communication Pattern
- Client gọi server qua `google.script.run.withSuccessHandler().withFailureHandler()`
- Server trả về plain JavaScript objects (JSON-serializable)
- Session token lưu trong `sessionStorage` phía client, cache phía server dùng `CacheService.getUserCache()` TTL 8 giờ

---

## Data Models

### Sheet: Incident Log (16 cột cố định)

| Cột | Tên cột            | Kiểu dữ liệu | Ghi chú                          |
|-----|--------------------|--------------|----------------------------------|
| A   | Mã sự cố           | String       | INC-YYYY-XXX                     |
| B   | Ngày sự cố         | String       | DD/MM/YYYY HH:MM:SS              |
| C   | Người dùng         | String       | Tên người báo hỏng               |
| D   | Bộ phận            | String       | Bộ phận người báo hỏng           |
| E   | Mã thiết bị        | String       | Mã từ Device_List                |
| F   | Tên thiết bị       | String       | Tên từ Device_List               |
| G   | Mô tả sự cố        | String       | Mô tả chi tiết                   |
| H   | Mức độ             | String       | Cao / Trung bình / Thấp          |
| I   | Trạng thái         | String       | Open / Closed                    |
| J   | Người xử lý        | String       | Tên IT Staff (điền khi đóng)     |
| K   | Kết quả xử lý      | String       | Mô tả kết quả (điền khi đóng)   |
| L   | Nguyên nhân gốc rễ | String       | Root cause (điền khi đóng)       |
| M   | Ngày đóng          | String       | DD/MM/YYYY HH:MM:SS (khi đóng)  |
| N   | Số sao             | Number       | 1–5 (điền khi đánh giá)          |
| O   | Người đánh giá     | String       | Tên người đánh giá               |
| P   | Ghi chú nội bộ     | String       | Để trống, dùng nội bộ IT         |

### Sheet: danh sách thiết bị

| Cột | Tên cột       | Ghi chú                    |
|-----|---------------|----------------------------|
| A   | Mã thiết bị   | Unique identifier          |
| B   | Tên thiết bị  | Tên mô tả                  |
| C   | Bộ phận       | Bộ phận đang sử dụng       |
| D   | Ngày mua      | Ngày mua thiết bị          |

### Sheet: user

| Cột | Tên cột      | Ghi chú                    |
|-----|--------------|----------------------------|
| A   | mail         | Email đăng nhập            |
| B   | mật khẩu     | Mật khẩu (plain text)      |
| C   | Tên          | Tên hiển thị               |
| D   | Bộ phận      | Bộ phận của người dùng     |
| E   | Số điện thoại| Số điện thoại liên hệ      |

---

## Module Design

### 1. Constants

```javascript
const SHEET_INCIDENT_LOG = 'Incident Log';
const SHEET_DEVICE_LIST  = 'danh sách thiết bị';
const SHEET_USER         = 'user';
const SPREADSHEET_ID     = '1z-Z0KxHFY3QJAxNoooMN4Or_Zki0IEfAkmN3YGMeUlQ';
```

### 2. Router Module

**`doGet(e)`**
- Đọc `e.parameter.deviceCode`
- Nếu có → trả về `HtmlService.createTemplateFromFile('DeviceInfo').evaluate()`
- Ngược lại → trả về `HtmlService.createTemplateFromFile('index').evaluate()`
- Cả hai đều set `XFrameOptionsMode.ALLOWALL` và title phù hợp

### 3. Auth Module

**`loginUser(email, password)`**
- Đọc sheet "user", duyệt từng row
- Nếu không tìm thấy email → `{success: false, error: "Email không tồn tại"}`
- Nếu sai mật khẩu → `{success: false, error: "Mật khẩu không đúng"}`
- Nếu đúng → tạo token = `Utilities.getUuid()`, lưu vào `CacheService.getUserCache()` với key=token, value=JSON(userName, department), TTL=28800s
- Trả về `{success: true, token, userName, department}`

**`validateSession(token)`**
- Lấy từ cache theo token
- Nếu không có → `{valid: false}`
- Nếu có → `{valid: true, userName, department}`

**`logoutUser(token)`**
- Xóa key token khỏi cache
- Trả về `{success: true}`

### 4. ID Generator Module

**`generateIncidentCode()`**
- Dùng `LockService.getScriptLock()`, `waitLock(10000)`
- Đọc toàn bộ Incident Log, lọc các mã INC-YYYY-XXX của năm hiện tại
- Tìm số thứ tự lớn nhất, cộng thêm 1 (hoặc bắt đầu từ 1 nếu chưa có)
- Trả về chuỗi `INC-${year}-${padStart(seq, 3, '0')}`
- Giải phóng lock sau khi xong

### 5. Device Module

**`getDeviceList()`**
- Đọc sheet "danh sách thiết bị", bỏ qua row header
- Trả về array `[{code, name, department, purchaseDate}, ...]`

**`getDeviceInfo(deviceCode)`**
- Tìm row có cột A = deviceCode
- Tính tuổi thiết bị từ ngày mua đến hôm nay (năm và tháng)
- Trả về `{success: true, device: {code, name, department, purchaseDate, age}}` hoặc `{success: false, error: "Mã thiết bị không tồn tại"}`

**`generateQRCodeUrl(deviceCode)`**
- Lấy URL Web App từ `ScriptApp.getService().getUrl()`
- Tạo URL QR: `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=encodeURIComponent(webAppUrl + '?deviceCode=' + deviceCode)`
- Trả về URL string

### 6. Incident Module

**`submitIncident(incidentData, sessionToken)`**
- Validate session → nếu không hợp lệ trả về lỗi
- Validate fields bắt buộc: userName, department, deviceCode, deviceName, description, severity
- Gọi `generateIncidentCode()`
- Ghi row 16 cột vào Incident Log (cột J-P để trống)
- Trả về `{success: true, incidentCode}` hoặc `{success: false, error}`

**`getOpenIncidents(sessionToken)`**
- Validate session
- Đọc Incident Log, lọc rows có cột I = "Open"
- Trả về array incidents với đầy đủ thông tin

**`resolveIncident(incidentCode, resolutionData, sessionToken)`**
- Validate session
- Validate fields: resolver, resolution (bắt buộc)
- Tìm row có cột A = incidentCode
- Kiểm tra status không phải "Closed"
- Cập nhật cột J (Người xử lý), K (Kết quả xử lý), L (Nguyên nhân gốc rễ), M (Ngày đóng), I (Trạng thái = "Closed")
- Trả về `{success: true, incidentCode}` hoặc `{success: false, error}`

**`rateIncident(incidentCode, rating, raterName, sessionToken)`**
- Validate session
- Validate rating: phải là số nguyên 1–5
- Tìm row có cột A = incidentCode
- Kiểm tra status = "Closed"
- Cập nhật cột N (Số sao), O (Người đánh giá)
- Trả về `{success: true}` hoặc `{success: false, error}`

### 7. Helper Module

**`formatTimestamp(date)`**
- Trả về chuỗi `DD/MM/YYYY HH:MM:SS`

**`getSheet(sheetName)`**
- `SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName)`

**`initIncidentLogHeaders()`**
- Kiểm tra nếu sheet trống (getLastRow() === 0) thì ghi header 16 cột vào row 1

---

## UI Design

### index.html — SPA Structure

```
┌─────────────────────────────────────────────────────┐
│  [Login View]  — hiển thị khi chưa đăng nhập        │
│  Email: [___________]  Password: [___________]       │
│  [Đăng nhập]                                         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Nav: IT Incident Management  |  Xin chào [Tên]  [Đăng xuất] │
│  [Báo hỏng] [Xử lý sự cố] [Đánh giá]               │
├─────────────────────────────────────────────────────┤
│  Tab 1: Báo hỏng                                     │
│  Mã thiết bị: [dropdown]  Tên thiết bị: [readonly]  │
│  Người dùng: [readonly]   Bộ phận: [readonly]        │
│  Mô tả sự cố: [textarea]                             │
│  Mức độ: [Cao|Trung bình|Thấp]                       │
│  [Gửi báo hỏng]                                      │
├─────────────────────────────────────────────────────┤
│  Tab 2: Xử lý sự cố                                  │
│  Bảng Open Incidents (màu theo severity)             │
│  [Đóng sự cố] → form: Người xử lý, Kết quả, Nguyên nhân │
│  ─────────────────────────────────────────────────  │
│  Tạo QR Code: [chọn thiết bị] → [QR image] [Tải]   │
├─────────────────────────────────────────────────────┤
│  Tab 3: Đánh giá                                     │
│  Mã sự cố: [input] [Tra cứu]                         │
│  ★★★★★ (star rating)                                 │
│  Tên người đánh giá: [input]                         │
│  [Gửi đánh giá]                                      │
└─────────────────────────────────────────────────────┘
```

### DeviceInfo.html — Public Page

```
┌─────────────────────────────────────────────────────┐
│  IT Incident Management — Thông tin thiết bị         │
│  ─────────────────────────────────────────────────  │
│  Mã thiết bị:    [TN141]                             │
│  Tên thiết bị:   [Laptop Dell XPS 15]                │
│  Bộ phận:        [Kế toán]                           │
│  Ngày mua:       [15/03/2021]                        │
│  Tuổi thiết bị:  [3 năm 2 tháng]                    │
│  ─────────────────────────────────────────────────  │
│  [🔴 Báo hỏng thiết bị này]                          │
└─────────────────────────────────────────────────────┘
```

---

## Security & Session Management

- Session token là UUID ngẫu nhiên, lưu server-side trong `CacheService.getUserCache()` TTL 8h
- Client lưu token trong `sessionStorage` (xóa khi đóng tab)
- Mọi thao tác ghi dữ liệu đều validate session token phía server
- DeviceInfo.html không yêu cầu session (public page)

---

## Error Handling Strategy

- Tất cả Sheets operations được bọc trong try/catch
- Server trả về `{success: false, error: "message"}` thay vì throw exception
- Client hiển thị error message rõ ràng cho người dùng
- Không để Incident Log ở trạng thái ghi dở (write toàn bộ row một lần)

---

## Severity Color Coding

| Mức độ    | Màu nền  | Hex       |
|-----------|----------|-----------|
| Cao       | Đỏ       | #FF4444   |
| Trung bình| Vàng     | #FFA500   |
| Thấp      | Xanh lá  | #44BB44   |

---

## QR Code Generation

- Dùng Google Charts API: `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=[encoded_url]`
- URL encode toàn bộ Web App URL + query parameter
- Hiển thị QR image trực tiếp trong browser bằng thẻ `<img>`
- Nút tải xuống dùng `<a download>` với href là QR URL
