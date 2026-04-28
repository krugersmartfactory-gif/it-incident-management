# Requirements Document

## Introduction

Hệ thống Quản lý Sự cố IT (IT Incident Management System) được xây dựng trên nền tảng Google Sheets và Google Apps Script, triển khai dưới dạng Web App. Hệ thống cho phép người dùng báo cáo sự cố thiết bị IT, bộ phận IT xử lý và đóng sự cố, và người dùng đánh giá chất lượng xử lý. Toàn bộ dữ liệu được lưu trữ trong Google Spreadsheet với ba sheet chính: "Incident Log", "danh sách thiết bị", và "Incident Form".

## Glossary

- **System**: Hệ thống Quản lý Sự cố IT (IT Incident Management System) — toàn bộ ứng dụng Web App chạy trên Google Apps Script
- **Incident_Log**: Sheet "Incident Log" trong Google Spreadsheet — nơi lưu trữ toàn bộ dữ liệu sự cố
- **Device_List**: Sheet "danh sách thiết bị" trong Google Spreadsheet — danh sách thiết bị IT của tổ chức
- **Incident_Form**: Sheet "Incident Form" trong Google Spreadsheet — sheet hỗ trợ giao diện nhập liệu
- **Web_App**: Giao diện web được triển khai từ Google Apps Script, người dùng truy cập qua trình duyệt
- **ID_Generator**: Module tạo mã sự cố tự động theo định dạng INC-YYYY-XXX
- **Incident_Code**: Mã sự cố theo định dạng INC-YYYY-XXX (VD: INC-2026-001), trong đó YYYY là năm hiện tại và XXX là số thứ tự 3 chữ số trong năm
- **Reporter**: Người dùng cuối báo cáo sự cố thiết bị IT
- **IT_Staff**: Nhân viên IT chịu trách nhiệm xử lý và đóng sự cố
- **Severity**: Mức độ nghiêm trọng của sự cố — gồm ba cấp: Cao (High), Trung bình (Medium), Thấp (Low)
- **Status**: Trạng thái sự cố — "Open" (đang mở) hoặc "Closed" (đã đóng)
- **Rating**: Điểm đánh giá chất lượng xử lý sự cố từ 1 đến 5 sao do Reporter cung cấp
- **Response_Time**: Thời gian tối đa cho phép từ khi sự cố được tạo đến khi IT bắt đầu xử lý
- **User_Sheet**: Sheet "user" trong Google Spreadsheet — lưu thông tin tài khoản người dùng với các cột: mail, mật khẩu, Tên, Bộ phận, Số điện thoại
- **Login_Session**: Phiên đăng nhập được duy trì sau khi người dùng xác thực thành công, lưu trữ thông tin Tên và Bộ phận của người dùng hiện tại
- **QR_Code**: Mã QR gắn trên mỗi thiết bị, chứa URL dạng `[WebAppURL]?deviceCode=[Mã thiết bị]` để dẫn trực tiếp đến trang thông tin thiết bị công khai
- **Device_Info_Page**: Trang thông tin thiết bị công khai — hiển thị Mã thiết bị, Tên thiết bị, Bộ phận sử dụng từ Device_List; không yêu cầu đăng nhập; có nút "Báo hỏng"
- **Authenticated_User**: Người dùng đã đăng nhập thành công và có Login_Session hợp lệ

---

## Requirements

### Requirement 1: Tạo mã sự cố tự động

**User Story:** As a Reporter, I want the system to automatically generate a unique incident code when I submit a report, so that each incident can be uniquely identified and tracked.

#### Acceptance Criteria

1. WHEN a new incident is submitted, THE ID_Generator SHALL create an Incident_Code in the format INC-YYYY-XXX, where YYYY is the current calendar year and XXX is a zero-padded 3-digit sequential number starting from 001.
2. WHEN a new incident is submitted in a new calendar year, THE ID_Generator SHALL reset the sequential counter to 001 for that year.
3. THE ID_Generator SHALL ensure each generated Incident_Code is unique within the Incident_Log.
4. IF two incidents are submitted simultaneously, THEN THE ID_Generator SHALL assign distinct Incident_Codes to each submission without duplication.

---

### Requirement 2: Báo hỏng — Ghi nhận sự cố mới (Report Incident)

**User Story:** As a Reporter, I want to submit an IT incident report through the Web App, so that the IT team is notified and can begin resolving the issue.

#### Acceptance Criteria

1. WHEN a user attempts to access the Báo hỏng form without an active Login_Session, THE Web_App SHALL redirect the user to the login form and SHALL preserve the current `deviceCode` query parameter (if present) so that device information is restored after successful login.
2. WHEN an Authenticated_User opens the Báo hỏng form, THE Web_App SHALL provide input fields for: Mã thiết bị (Device Code), Tên thiết bị (Device Name, read-only), Mô tả sự cố (Incident description), and Mức độ (Severity: Cao/High, Trung bình/Medium, Thấp/Low); and SHALL automatically populate Người dùng and Bộ phận from the Login_Session and set those fields to read-only.
3. WHEN an Authenticated_User opens the Báo hỏng form with a `deviceCode` query parameter, THE Web_App SHALL automatically populate the Mã thiết bị field with the provided device code and SHALL look up and populate the Tên thiết bị field from the Device_List sheet.
4. WHEN the Reporter selects a Mã thiết bị from the form manually, THE Web_App SHALL automatically populate the Tên thiết bị field by looking up the value in the Device_List sheet.
5. WHEN the Reporter submits the incident form with all required fields filled, THE System SHALL write a new row to the Incident_Log sheet containing: Incident_Code, Ngày sự cố (current date and time), Người dùng, Bộ phận, Mã thiết bị, Tên thiết bị, Mô tả sự cố, Mức độ, and Trạng thái = "Open".
6. IF any required field (Người dùng, Bộ phận, Mã thiết bị, Mô tả sự cố, Mức độ) is empty when the Reporter submits the form, THEN THE Web_App SHALL display a descriptive validation error message and SHALL NOT write any data to the Incident_Log.
7. WHEN the incident is successfully recorded, THE Web_App SHALL display a confirmation message to the Reporter showing the generated Incident_Code.

---

### Requirement 3: Tra cứu thiết bị từ danh sách (Device Lookup)

**User Story:** As a Reporter, I want to select a device from a dropdown list when reporting an incident, so that device information is accurate and consistent with the official device registry.

#### Acceptance Criteria

1. THE Web_App SHALL populate the Mã thiết bị dropdown by reading all device entries from the Device_List sheet.
2. WHEN the Device_List sheet is updated with new or removed devices, THE Web_App SHALL reflect the updated device list on the next form load.
3. IF the Device_List sheet contains no entries, THEN THE Web_App SHALL display an informational message indicating that no devices are available for selection.

---

### Requirement 4: Xử lý sự cố — Cập nhật và đóng sự cố (Process/Resolve Incident)

**User Story:** As an IT_Staff member, I want to update the resolution details of an incident and change its status to Closed, so that the incident record reflects the completed work and can be used for reporting.

#### Acceptance Criteria

1. THE Web_App SHALL provide IT_Staff with a view listing all incidents with Status = "Open" from the Incident_Log.
2. WHEN IT_Staff selects an Open incident and submits resolution details, THE System SHALL update the corresponding row in the Incident_Log with: Người xử lý (IT Staff name), Kết quả xử lý (Resolution result), Nguyên nhân gốc rễ (Root cause), Ngày đóng (current date), and Trạng thái = "Closed".
3. IF IT_Staff attempts to close an incident without providing Kết quả xử lý or Người xử lý, THEN THE Web_App SHALL display a validation error and SHALL NOT update the Incident_Log row.
4. WHEN an incident is successfully closed, THE Web_App SHALL display a confirmation message to IT_Staff showing the Incident_Code that was closed.
5. IF IT_Staff attempts to update an incident with Status = "Closed", THEN THE Web_App SHALL display an error message indicating the incident is already closed and SHALL NOT modify the row.

---

### Requirement 5: Đánh giá chất lượng xử lý (Rate/Review Incident)

**User Story:** As a Reporter, I want to rate the quality of IT support after my incident is resolved, so that the organization can monitor IT service quality.

#### Acceptance Criteria

1. THE Web_App SHALL allow a Reporter to submit a Rating for an incident only when the incident's Status = "Closed".
2. WHEN a Reporter submits a Rating, THE System SHALL update the corresponding row in the Incident_Log with: Số sao (integer value from 1 to 5 inclusive) and Người đánh giá (name of the person submitting the rating).
3. IF a Reporter submits a Rating value outside the range of 1 to 5, THEN THE Web_App SHALL display a validation error and SHALL NOT update the Incident_Log.
4. IF a Reporter attempts to rate an incident with Status = "Open", THEN THE Web_App SHALL display an error message indicating the incident has not been resolved yet and SHALL NOT update the Incident_Log.
5. WHEN a Rating is successfully recorded, THE Web_App SHALL display a confirmation message to the Reporter.

---

### Requirement 6: Phân loại mức độ và thời gian phản hồi (Severity Classification & Response Time)

**User Story:** As an IT_Staff member, I want the system to enforce response time expectations based on incident severity, so that critical incidents receive priority attention.

#### Acceptance Criteria

1. THE System SHALL classify each incident into one of three Severity levels at the time of submission: Cao (High), Trung bình (Medium), or Thấp (Low).
2. WHILE an incident has Severity = "Cao" and Status = "Open", THE Web_App SHALL visually highlight the incident to indicate a Response_Time target of ≤ 1 hour.
3. WHILE an incident has Severity = "Trung bình" and Status = "Open", THE Web_App SHALL visually highlight the incident to indicate a Response_Time target of ≤ 4 hours.
4. WHILE an incident has Severity = "Thấp" and Status = "Open", THE Web_App SHALL display the incident with a Response_Time target of ≤ 1 business day.
5. THE Incident_Log SHALL store the Severity value as one of the three defined values: "Cao", "Trung bình", or "Thấp".

---

### Requirement 7: Cấu trúc dữ liệu Incident Log (Incident Log Data Structure)

**User Story:** As an IT_Staff member, I want the Incident Log sheet to maintain a consistent column structure, so that data can be reliably read, written, and reported on.

#### Acceptance Criteria

1. THE Incident_Log SHALL maintain columns in the following fixed order: Mã sự cố, Ngày sự cố, Người dùng, Bộ phận, Mã thiết bị, Tên thiết bị, Mô tả sự cố, Mức độ, Trạng thái, Người xử lý, Kết quả xử lý, Nguyên nhân gốc rễ, Ngày đóng, Số sao, Người đánh giá, Ghi chú nội bộ.
2. WHEN a new incident row is written to the Incident_Log, THE System SHALL leave the following columns empty: Người xử lý, Kết quả xử lý, Nguyên nhân gốc rễ, Ngày đóng, Số sao, Người đánh giá, Ghi chú nội bộ.
3. THE System SHALL write Ngày sự cố as a timestamp in the format DD/MM/YYYY HH:MM:SS.

---

### Requirement 8: Giao diện Web App (Web App Interface)

**User Story:** As a user (Reporter or IT_Staff), I want a clear and navigable web interface, so that I can perform my tasks without needing to access the Google Spreadsheet directly.

#### Acceptance Criteria

1. THE Web_App SHALL present distinct views or tabs for: (1) Báo hỏng (Report Incident), (2) Xử lý sự cố (Process Incident), and (3) Đánh giá (Rate Incident).
2. WHEN the Web_App is loaded, THE Web_App SHALL display the Báo hỏng view as the default view.
3. THE Web_App SHALL be accessible via a published Google Apps Script Web App URL without requiring the user to open the Google Spreadsheet.
4. IF a Google Sheets API call fails during form submission, THEN THE Web_App SHALL display a descriptive error message to the user and SHALL NOT leave the Incident_Log in a partially written state.

---

### Requirement 9: Đăng nhập người dùng (User Login)

**User Story:** As a Reporter, I want to log in with my email and password, so that the system can automatically fill in my name and department when I submit an incident report.

#### Acceptance Criteria

1. THE Web_App SHALL provide a login form with two fields: mail (email address) and mật khẩu (password).
2. WHEN a user submits the login form, THE System SHALL look up the provided mail in the User_Sheet and verify that the provided mật khẩu matches the stored value for that mail.
3. WHEN the credentials are valid, THE System SHALL create a Login_Session storing the user's Tên and Bộ phận from the User_Sheet, and SHALL redirect the user to the Báo hỏng form (preserving any `deviceCode` parameter if present).
4. IF the provided mail does not exist in the User_Sheet, THEN THE Web_App SHALL display the error message "Email không tồn tại" and SHALL NOT create a Login_Session.
5. IF the provided mật khẩu does not match the stored value for the given mail, THEN THE Web_App SHALL display the error message "Mật khẩu không đúng" and SHALL NOT create a Login_Session.
6. WHILE a Login_Session is active, THE Web_App SHALL display the authenticated user's Tên in the navigation area.
7. WHEN an Authenticated_User clicks the logout action, THE System SHALL destroy the Login_Session and SHALL redirect the user to the login form.
8. THE Web_App SHALL require an active Login_Session only for the following actions: accessing the Báo hỏng form, submitting an incident report, processing/closing an incident (IT_Staff), and submitting a Rating.
9. THE Device_Info_Page SHALL be accessible without a Login_Session and SHALL NOT redirect unauthenticated users to the login form.

---

### Requirement 10: Quét mã QR để báo hỏng nhanh (QR Code Quick Report)

**User Story:** As a Reporter, I want to scan a QR code on a device to open a pre-filled incident report form, so that I can submit an incident quickly without manually searching for the device.

#### Acceptance Criteria

1. THE System SHALL generate a unique QR_Code for each device in the Device_List, where each QR_Code encodes a URL in the format `[WebAppURL]?deviceCode=[Mã thiết bị]` (e.g., `[WebAppURL]?deviceCode=TN141`).
2. WHEN a user opens the Web_App URL containing a `deviceCode` query parameter, THE Web_App SHALL automatically populate the Mã thiết bị field with the provided device code value.
3. WHEN the Web_App populates the Mã thiết bị field from a `deviceCode` query parameter, THE Web_App SHALL automatically look up and populate the Tên thiết bị field from the Device_List sheet.
4. IF the `deviceCode` value from the query parameter does not exist in the Device_List, THEN THE Web_App SHALL display an error message "Mã thiết bị không tồn tại" and SHALL leave the Mã thiết bị and Tên thiết bị fields empty.
5. WHEN an Authenticated_User opens the Web_App via a QR_Code URL, THE Web_App SHALL automatically populate Mã thiết bị, Tên thiết bị, Người dùng, and Bộ phận fields, leaving only Mô tả sự cố and Mức độ for the user to complete.
6. WHEN a non-authenticated user opens the Web_App via a QR_Code URL, THE Web_App SHALL redirect the user to the login form and SHALL preserve the `deviceCode` query parameter so that the device fields are pre-filled after successful login.
7. THE Web_App SHALL provide IT_Staff with a function to display or download the QR_Code image for any selected device from the Device_List.
