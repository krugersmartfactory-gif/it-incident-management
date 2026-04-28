# Tasks — IT Incident Management System

## Task List

- [x] 1. Tạo file Code.gs — Server-side Google Apps Script
  - [x] 1.1 Constants và Helper functions (getSheet, formatTimestamp, formatDateOnly, calculateDeviceAge, initIncidentLogHeaders)
  - [x] 1.2 Auth Module (loginUser, validateSession, logoutUser với CacheService TTL 8h)
  - [x] 1.3 ID Generator Module (generateIncidentCode với LockService)
  - [x] 1.4 Device Module (getDeviceList, getDeviceInfo, generateQRCodeUrl)
  - [x] 1.5 Incident Module (submitIncident, getOpenIncidents, resolveIncident, rateIncident)
  - [x] 1.6 Router doGet(e) — phân luồng deviceCode → DeviceInfo, mặc định → index

- [x] 2. Tạo file Login.html — Form đăng nhập
  - [x] 2.1 Form email/password với validation và hiển thị lỗi
  - [x] 2.2 Gọi loginUser(), lưu token/userName/department vào sessionStorage
  - [x] 2.3 Redirect sau login, giữ nguyên deviceCode query param nếu có

- [x] 3. Tạo file DeviceInfo.html — Trang thông tin thiết bị công khai
  - [x] 3.1 Load và hiển thị thông tin thiết bị từ deviceCode URL param (gọi getDeviceInfo)
  - [x] 3.2 Nút Báo hỏng với logic redirect: đã đăng nhập → ?page=report&deviceCode=..., chưa đăng nhập → ?page=login&deviceCode=...
  - [x] 3.3 Style mobile-friendly, loading state, error state

- [ ] 4. Tạo file index.html — SPA chính
  - [ ] 4.1 Session check khi load trang
    - Đọc token từ sessionStorage; nếu không có hoặc validateSession trả về invalid → redirect về Login.html
    - Hiển thị tên user trên navigation bar sau khi xác thực thành công
    - _Requirements: 9.1, 9.6, 9.8_
  - [ ] 4.2 Navigation bar
    - Hiển thị tiêu đề hệ thống, tên người dùng đang đăng nhập
    - Nút Đăng xuất: gọi logoutUser(), xóa sessionStorage, redirect về Login.html
    - Ba tab điều hướng: Báo hỏng / Xử lý sự cố / Đánh giá
    - _Requirements: 8.1, 8.2, 9.6, 9.7_
  - [ ] 4.3 Tab 1 — Báo hỏng
    - Dropdown Mã thiết bị: gọi getDeviceList() khi load, hiển thị danh sách hoặc thông báo nếu rỗng
    - Khi chọn thiết bị từ dropdown: tự động điền Tên thiết bị (read-only)
    - Người dùng và Bộ phận: điền từ sessionStorage, set read-only
    - Textarea Mô tả sự cố và select Mức độ (Cao / Trung bình / Thấp)
    - Submit: validate client-side, gọi submitIncident(), hiển thị mã sự cố khi thành công
    - _Requirements: 2.2, 2.4, 2.5, 2.6, 2.7, 3.1, 3.3, 6.1_
  - [ ] 4.4 Xử lý URL params khi load
    - Đọc `deviceCode` param: nếu có, chuyển sang Tab Báo hỏng và pre-fill Mã thiết bị + Tên thiết bị
    - Đọc `page=report` param: nếu có, chuyển thẳng vào Tab Báo hỏng
    - Nếu deviceCode không tồn tại trong danh sách: hiển thị lỗi "Mã thiết bị không tồn tại"
    - _Requirements: 2.1, 2.3, 10.2, 10.3, 10.4, 10.5_
  - [ ] 4.5 Tab 2 — Xử lý sự cố
    - Bảng Open Incidents: gọi getOpenIncidents(), render bảng với màu nền theo severity (Cao: #FF4444, Trung bình: #FFA500, Thấp: #44BB44)
    - Nút Đóng sự cố trên mỗi row: mở form inline với các field Người xử lý (bắt buộc), Kết quả xử lý (bắt buộc), Nguyên nhân gốc rễ (tùy chọn)
    - Submit form đóng: gọi resolveIncident(), hiển thị xác nhận, refresh bảng
    - Phần QR Generator: dropdown chọn thiết bị, gọi generateQRCodeUrl(), hiển thị ảnh QR và nút tải xuống
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.2, 6.3, 6.4, 10.7_
  - [ ] 4.6 Tab 3 — Đánh giá
    - Input Mã sự cố và nút Tra cứu để kiểm tra trạng thái sự cố
    - Star rating UI (1–5 sao, click để chọn)
    - Input Tên người đánh giá
    - Submit: validate rating trong khoảng 1–5, gọi rateIncident(), hiển thị xác nhận
    - Hiển thị lỗi nếu sự cố chưa đóng hoặc mã không tồn tại
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 5. Checkpoint — Kiểm tra toàn bộ luồng
  - Đảm bảo luồng QR scan → DeviceInfo → Login → index (Tab Báo hỏng pre-filled) hoạt động end-to-end
  - Đảm bảo luồng Báo hỏng → Xử lý sự cố → Đánh giá hoạt động đúng
  - Hỏi người dùng nếu có vấn đề phát sinh.
