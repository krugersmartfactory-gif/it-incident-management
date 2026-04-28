# Requirements Document

## Introduction

Hệ thống IT Incident Management hiện tại được xây dựng trên nền tảng Google Apps Script với Google Sheets làm cơ sở dữ liệu. Để tăng hiệu suất, khả năng mở rộng và dễ dàng bảo trì, hệ thống cần được migration sang Supabase - một nền tảng Backend-as-a-Service (BaaS) dựa trên PostgreSQL.

**Mục tiêu migration:**
- Chuyển đổi từ Google Sheets sang Supabase PostgreSQL database
- Thay thế Google Apps Script backend bằng Supabase Functions hoặc API calls trực tiếp
- Giữ nguyên 100% tính năng hiện tại
- Giữ nguyên UI/UX của frontend (index.html)
- Tận dụng các tính năng của Supabase: Realtime, Auth, Storage, Functions
- Cải thiện hiệu suất và khả năng mở rộng

**Phạm vi:**
- Migration toàn bộ dữ liệu từ Google Sheets sang Supabase PostgreSQL
- Chuyển đổi authentication system sang Supabase Auth
- Chuyển đổi business logic từ Google Apps Script sang Supabase Functions hoặc client-side
- Chuyển đổi email notification system
- Cập nhật frontend để tích hợp với Supabase API
- Đảm bảo QR code scanning vẫn hoạt động

## Glossary

- **Migration_System**: Hệ thống migration từ Google Apps Script sang Supabase
- **Supabase_Database**: Cơ sở dữ liệu PostgreSQL trên Supabase
- **Supabase_Auth**: Hệ thống xác thực của Supabase
- **Supabase_Functions**: Edge Functions của Supabase để xử lý business logic
- **Frontend_Client**: Ứng dụng web HTML/JavaScript (index.html)
- **Email_Service**: Dịch vụ gửi email thông báo
- **QR_Scanner**: Tính năng quét mã QR để truy cập thông tin thiết bị
- **Session_Token**: Token xác thực phiên đăng nhập
- **Incident_Record**: Bản ghi sự cố trong hệ thống
- **Device_Record**: Bản ghi thiết bị trong hệ thống
- **User_Record**: Bản ghi người dùng trong hệ thống
- **Email_Queue**: Hàng đợi email chờ gửi
- **RLS_Policy**: Row Level Security Policy của PostgreSQL
- **API_Key**: Khóa API của Supabase (anon key hoặc service role key)

## Requirements

### Requirement 1: Database Schema Migration

**User Story:** As a system administrator, I want to migrate all data from Google Sheets to Supabase PostgreSQL, so that the system can leverage PostgreSQL's performance and features.

#### Acceptance Criteria

1. THE Migration_System SHALL create a "users" table in Supabase_Database with columns: id (UUID primary key), email (unique), password_hash, name, department, phone, access_role, form_access, password_last_changed, created_at, updated_at
2. THE Migration_System SHALL create a "devices" table in Supabase_Database with columns: id (UUID primary key), code (unique), name, department, purchase_date, status, created_at, updated_at
3. THE Migration_System SHALL create an "incidents" table in Supabase_Database with columns: id (UUID primary key), incident_code (unique), incident_date, user_name, department, device_code, device_name, description, severity, status, resolver, resolution, root_cause, resolve_date, rating, rater_name, attitude_comment, created_at, updated_at
4. THE Migration_System SHALL create an "email_queue" table in Supabase_Database with columns: id (UUID primary key), created_at, status, retry_count, last_attempt, subject, to_email, cc_emails, html_body, error_log
5. THE Migration_System SHALL migrate all existing data from Google Sheets "user" to Supabase_Database "users" table preserving all field values
6. THE Migration_System SHALL migrate all existing data from Google Sheets "danh sách thiết bị" to Supabase_Database "devices" table preserving all field values
7. THE Migration_System SHALL migrate all existing data from Google Sheets "Incident Log" to Supabase_Database "incidents" table preserving all field values
8. THE Migration_System SHALL migrate all existing data from Google Sheets "EMAIL_QUEUE" to Supabase_Database "email_queue" table preserving all field values
9. THE Migration_System SHALL create appropriate indexes on frequently queried columns (email, device_code, incident_code, status)
10. THE Migration_System SHALL create foreign key relationships where appropriate (incidents.device_code references devices.code)

### Requirement 2: Authentication System Migration

**User Story:** As a user, I want to log in using Supabase Auth, so that my authentication is secure and managed by a modern authentication system.

#### Acceptance Criteria

1. THE Supabase_Auth SHALL authenticate users using email and password
2. WHEN a user submits valid credentials, THE Supabase_Auth SHALL return a JWT access token and refresh token
3. WHEN a user submits invalid credentials, THE Supabase_Auth SHALL return an authentication error
4. THE Frontend_Client SHALL store the JWT access token in sessionStorage
5. THE Frontend_Client SHALL include the JWT access token in the Authorization header for all API requests
6. THE Supabase_Auth SHALL validate JWT tokens on every authenticated request
7. WHEN a JWT token expires, THE Frontend_Client SHALL use the refresh token to obtain a new access token
8. THE Supabase_Auth SHALL support password change functionality
9. THE Migration_System SHALL migrate existing user passwords from Google Sheets to Supabase_Auth (users will need to reset passwords if hashing is incompatible)
10. THE Supabase_Auth SHALL enforce password minimum length of 6 characters

### Requirement 3: User Authorization and Permissions

**User Story:** As a system administrator, I want to control user access based on their roles and permissions, so that users only see features they are authorized to use.

#### Acceptance Criteria

1. THE Supabase_Database SHALL store user access_role in the users table (values: "user", "manager")
2. THE Supabase_Database SHALL store user form_access in the users table (values: "báo hỏng", "xử lý", "đánh giá", or combinations)
3. THE Frontend_Client SHALL read user access_role and form_access from the authenticated user's profile
4. WHEN a user has form_access containing "báo hỏng", THE Frontend_Client SHALL display the "Báo hỏng" tab
5. WHEN a user has form_access containing "xử lý", THE Frontend_Client SHALL display the "Xử lý sự cố" tab
6. WHEN a user has form_access containing "đánh giá", THE Frontend_Client SHALL display the "Đánh giá" tab
7. THE Supabase_Database SHALL implement Row Level Security (RLS) policies to restrict data access based on user roles
8. THE RLS_Policy SHALL allow users to read only their own user record
9. THE RLS_Policy SHALL allow users to create incidents for any device
10. THE RLS_Policy SHALL allow users with "xử lý" permission to update incident status and resolution fields

### Requirement 4: Device Management

**User Story:** As a user, I want to view device information and submit incident reports for devices, so that I can report equipment issues.

#### Acceptance Criteria

1. THE Frontend_Client SHALL fetch the list of all devices from Supabase_Database using the Supabase JavaScript client
2. WHEN a user scans a QR code with device code, THE Frontend_Client SHALL extract the device code from the URL parameter
3. WHEN a device code is present in the URL, THE Frontend_Client SHALL fetch device information from Supabase_Database by device code
4. THE Frontend_Client SHALL display device information including: code, name, department, purchase_date, age (calculated), repair_count (calculated)
5. THE Frontend_Client SHALL calculate device age in months from purchase_date to current date
6. THE Frontend_Client SHALL count repair incidents by querying Supabase_Database for incidents with matching device_code and status "Closed"
7. THE Supabase_Database SHALL support querying devices by code with case-insensitive matching
8. THE Frontend_Client SHALL cache device information in sessionStorage after fetching
9. WHEN a user is not authenticated, THE Frontend_Client SHALL display device information but require login to submit incidents
10. THE Frontend_Client SHALL generate QR code URLs using the web app URL with device code as query parameter

### Requirement 5: Incident Submission

**User Story:** As a user, I want to submit incident reports for broken equipment, so that IT staff can be notified and resolve the issue.

#### Acceptance Criteria

1. WHEN a user submits an incident report, THE Frontend_Client SHALL validate that all required fields are filled (userName, department, deviceCode, deviceName, description, severity)
2. WHEN a user submits an incident report, THE Frontend_Client SHALL validate that severity is one of: "Cao", "Trung bình", "Thấp"
3. WHEN validation passes, THE Frontend_Client SHALL generate a unique incident code in format "INC-YYYY-XXX" where YYYY is current year and XXX is sequential number
4. THE Frontend_Client SHALL insert a new incident record into Supabase_Database with status "Open"
5. WHEN an incident is successfully created, THE Frontend_Client SHALL enqueue an email notification in the email_queue table
6. WHEN an incident is successfully created, THE Frontend_Client SHALL return the incident_code to the user
7. THE Frontend_Client SHALL display a success message with the incident_code
8. THE Frontend_Client SHALL reset the incident submission form after successful submission
9. THE Supabase_Database SHALL ensure incident_code uniqueness using a unique constraint
10. THE Frontend_Client SHALL handle concurrent incident submissions by using database-level sequence or atomic increment for incident numbering

### Requirement 6: Incident Resolution

**User Story:** As an IT staff member, I want to view open incidents and mark them as resolved with resolution details, so that users know their issues have been addressed.

#### Acceptance Criteria

1. THE Frontend_Client SHALL fetch all open incidents from Supabase_Database where status is "Open"
2. THE Frontend_Client SHALL display open incidents in a table with columns: incident_code, device_code, description, severity, action button
3. WHEN an IT staff member clicks "Xử lý" on an incident, THE Frontend_Client SHALL display a resolution form
4. THE Frontend_Client SHALL validate that resolver and resolution fields are filled before submission
5. WHEN resolution is submitted, THE Frontend_Client SHALL update the incident record in Supabase_Database with: status "Closed", resolver, resolution, root_cause, resolve_date
6. WHEN an incident is successfully resolved, THE Frontend_Client SHALL enqueue an email notification in the email_queue table
7. WHEN an incident is successfully resolved, THE Frontend_Client SHALL display a success message
8. THE Frontend_Client SHALL refresh the open incidents list after successful resolution
9. THE Frontend_Client SHALL prevent resolving an incident that is already closed
10. THE Supabase_Database SHALL record the resolve_date as the current timestamp when status changes to "Closed"

### Requirement 7: Incident Rating

**User Story:** As a user, I want to rate the quality of incident resolution, so that I can provide feedback on IT service quality.

#### Acceptance Criteria

1. THE Frontend_Client SHALL fetch unrated incidents for a specific device from Supabase_Database where device_code matches and status is "Closed" and rating is null
2. THE Frontend_Client SHALL display unrated incidents in a list with incident_code, device_code, and description
3. WHEN a user selects an incident to rate, THE Frontend_Client SHALL populate the incident_code field
4. THE Frontend_Client SHALL allow users to select a rating from 1 to 5 stars
5. THE Frontend_Client SHALL display rating labels: 1 star "Rất không hài lòng", 2 stars "Không hài lòng", 3 stars "Bình thường", 4 stars "Hài lòng", 5 stars "Rất hài lòng"
6. THE Frontend_Client SHALL validate that a rating is selected before submission
7. WHEN a rating is submitted, THE Frontend_Client SHALL update the incident record in Supabase_Database with: rating, rater_name, attitude_comment
8. WHEN a rating is successfully submitted, THE Frontend_Client SHALL display a success message
9. THE Frontend_Client SHALL refresh the unrated incidents list after successful rating
10. THE Supabase_Database SHALL prevent rating an incident that is not in "Closed" status

### Requirement 8: Email Notification System

**User Story:** As a user, I want to receive email notifications when I submit an incident and when it is resolved, so that I stay informed about the status of my requests.

#### Acceptance Criteria

1. WHEN an incident is submitted, THE Frontend_Client SHALL insert an email record into the email_queue table with status "PENDING"
2. WHEN an incident is resolved, THE Frontend_Client SHALL insert an email record into the email_queue table with status "PENDING"
3. THE Email_Service SHALL be implemented as a Supabase Edge Function that processes the email_queue table
4. THE Email_Service SHALL run on a scheduled trigger (every 1 minute) or be invoked via webhook
5. WHEN the Email_Service runs, THE Email_Service SHALL fetch all email records with status "PENDING" or "FAILED" with retry_count less than 3
6. FOR EACH pending email, THE Email_Service SHALL send the email using an SMTP service (e.g., SendGrid, Resend, or SMTP relay)
7. WHEN an email is successfully sent, THE Email_Service SHALL update the email record status to "SENT" and set last_attempt timestamp
8. WHEN an email fails to send, THE Email_Service SHALL update the email record status to "FAILED", increment retry_count, and log the error in error_log
9. WHEN an email fails 3 times, THE Email_Service SHALL update the email record status to "DEAD"
10. THE Email_Service SHALL build HTML email content with incident details, device information, and appropriate formatting

### Requirement 9: Password Management

**User Story:** As a user, I want to change my password, so that I can maintain account security.

#### Acceptance Criteria

1. THE Frontend_Client SHALL display a password change modal when the user clicks "Đổi mật khẩu"
2. THE Frontend_Client SHALL validate that the new password is at least 6 characters long
3. THE Frontend_Client SHALL validate that the new password and confirmation password match
4. WHEN a user submits a password change request, THE Supabase_Auth SHALL verify the old password
5. WHEN the old password is correct, THE Supabase_Auth SHALL update the user's password to the new password
6. WHEN the old password is incorrect, THE Supabase_Auth SHALL return an error "Mật khẩu cũ không đúng"
7. WHEN a password is successfully changed, THE Supabase_Database SHALL update the password_last_changed timestamp in the users table
8. WHEN a password is successfully changed, THE Frontend_Client SHALL display a success message
9. THE Frontend_Client SHALL close the password change modal after 2 seconds on success
10. THE Supabase_Auth SHALL hash passwords using bcrypt or similar secure hashing algorithm

### Requirement 10: Session Management

**User Story:** As a user, I want my login session to be maintained securely, so that I don't have to log in repeatedly during my work session.

#### Acceptance Criteria

1. WHEN a user logs in successfully, THE Supabase_Auth SHALL return an access token with 1 hour expiration and a refresh token
2. THE Frontend_Client SHALL store the access token in sessionStorage
3. THE Frontend_Client SHALL store the refresh token in localStorage for persistent sessions
4. WHEN the Frontend_Client makes an API request, THE Frontend_Client SHALL include the access token in the Authorization header as "Bearer {token}"
5. WHEN an access token expires, THE Frontend_Client SHALL automatically use the refresh token to obtain a new access token
6. WHEN a user logs out, THE Frontend_Client SHALL call Supabase_Auth signOut method to invalidate the session
7. WHEN a user logs out, THE Frontend_Client SHALL clear sessionStorage and localStorage
8. WHEN a user closes the browser, THE Frontend_Client SHALL maintain the session if a valid refresh token exists in localStorage
9. THE Supabase_Auth SHALL validate the JWT signature on every authenticated request
10. THE Supabase_Auth SHALL reject requests with expired or invalid tokens

### Requirement 11: QR Code Integration

**User Story:** As a user, I want to scan a QR code on equipment to quickly access the incident reporting form for that device, so that I can report issues efficiently.

#### Acceptance Criteria

1. THE Frontend_Client SHALL check for a device code in the URL query parameter (e.g., ?id=TN141)
2. WHEN a device code is present in the URL, THE Frontend_Client SHALL display the Device Info Page instead of the login page
3. THE Frontend_Client SHALL fetch device information from Supabase_Database using the device code from the URL
4. THE Frontend_Client SHALL display device information including: code, name, department, purchase_date, age, repair_count
5. WHEN a user is not authenticated, THE Frontend_Client SHALL display a login prompt on the Device Info Page
6. WHEN a user logs in from the Device Info Page, THE Frontend_Client SHALL redirect to the main app with the device pre-selected in the incident form
7. THE Frontend_Client SHALL generate QR code image URLs using Google Charts API with the web app URL and device code
8. THE Frontend_Client SHALL cache device information in sessionStorage to avoid redundant API calls
9. WHEN a user logs out from the Device Info Page, THE Frontend_Client SHALL return to the Device Info Page (not the login page)
10. THE Frontend_Client SHALL handle invalid device codes by displaying an error message "Mã thiết bị không tồn tại"

### Requirement 12: Frontend API Integration

**User Story:** As a developer, I want the frontend to communicate with Supabase using the Supabase JavaScript client, so that the application can perform CRUD operations on the database.

#### Acceptance Criteria

1. THE Frontend_Client SHALL initialize the Supabase JavaScript client with the Supabase URL and anon API key
2. THE Frontend_Client SHALL use supabase.auth.signInWithPassword() for user login
3. THE Frontend_Client SHALL use supabase.auth.signOut() for user logout
4. THE Frontend_Client SHALL use supabase.auth.updateUser() for password changes
5. THE Frontend_Client SHALL use supabase.from('devices').select() to fetch device lists
6. THE Frontend_Client SHALL use supabase.from('incidents').insert() to create new incidents
7. THE Frontend_Client SHALL use supabase.from('incidents').update() to resolve incidents and add ratings
8. THE Frontend_Client SHALL use supabase.from('incidents').select() to fetch open and unrated incidents
9. THE Frontend_Client SHALL use supabase.from('email_queue').insert() to enqueue email notifications
10. THE Frontend_Client SHALL handle Supabase API errors gracefully and display user-friendly error messages

### Requirement 13: Row Level Security (RLS) Policies

**User Story:** As a system administrator, I want to enforce data access controls at the database level, so that users can only access data they are authorized to see.

#### Acceptance Criteria

1. THE Supabase_Database SHALL enable Row Level Security on the users table
2. THE RLS_Policy SHALL allow authenticated users to read only their own user record (WHERE auth.uid() = id)
3. THE Supabase_Database SHALL enable Row Level Security on the devices table
4. THE RLS_Policy SHALL allow all authenticated users to read all device records
5. THE Supabase_Database SHALL enable Row Level Security on the incidents table
6. THE RLS_Policy SHALL allow all authenticated users to read all incident records
7. THE RLS_Policy SHALL allow all authenticated users to insert new incident records
8. THE RLS_Policy SHALL allow users with form_access containing "xử lý" to update incident resolution fields (resolver, resolution, root_cause, resolve_date, status)
9. THE RLS_Policy SHALL allow all authenticated users to update incident rating fields (rating, rater_name, attitude_comment)
10. THE Supabase_Database SHALL enable Row Level Security on the email_queue table with policies allowing service role access only

### Requirement 14: Data Migration Script

**User Story:** As a system administrator, I want a migration script to transfer data from Google Sheets to Supabase, so that existing data is preserved during the migration.

#### Acceptance Criteria

1. THE Migration_System SHALL provide a Node.js or Python script to export data from Google Sheets
2. THE Migration_System SHALL authenticate with Google Sheets API using service account credentials
3. THE Migration_System SHALL read all rows from the "user" sheet and transform them to match the Supabase users table schema
4. THE Migration_System SHALL read all rows from the "danh sách thiết bị" sheet and transform them to match the Supabase devices table schema
5. THE Migration_System SHALL read all rows from the "Incident Log" sheet and transform them to match the Supabase incidents table schema
6. THE Migration_System SHALL read all rows from the "EMAIL_QUEUE" sheet and transform them to match the Supabase email_queue table schema
7. THE Migration_System SHALL insert transformed data into Supabase_Database using the Supabase JavaScript client or REST API
8. THE Migration_System SHALL handle data type conversions (e.g., date strings to timestamps)
9. THE Migration_System SHALL log migration progress and any errors encountered
10. THE Migration_System SHALL provide a rollback mechanism in case of migration failure

### Requirement 15: Realtime Updates (Optional Enhancement)

**User Story:** As an IT staff member, I want to see new incidents appear in real-time without refreshing the page, so that I can respond to issues immediately.

#### Acceptance Criteria

1. THE Frontend_Client SHALL subscribe to Supabase Realtime changes on the incidents table
2. WHEN a new incident is inserted, THE Frontend_Client SHALL receive a realtime event
3. WHEN a new incident is inserted, THE Frontend_Client SHALL add the incident to the open incidents list without page refresh
4. WHEN an incident is updated to "Closed" status, THE Frontend_Client SHALL receive a realtime event
5. WHEN an incident is updated to "Closed" status, THE Frontend_Client SHALL remove the incident from the open incidents list without page refresh
6. THE Frontend_Client SHALL handle realtime connection errors gracefully and attempt to reconnect
7. THE Frontend_Client SHALL display a connection status indicator (connected/disconnected)
8. THE Supabase_Database SHALL enable Realtime replication on the incidents table
9. THE Frontend_Client SHALL unsubscribe from Realtime channels when navigating away from the incidents page
10. THE Frontend_Client SHALL filter Realtime events to only show incidents relevant to the current user's view

### Requirement 16: Performance Optimization

**User Story:** As a user, I want the application to load quickly and respond to my actions without delay, so that I can work efficiently.

#### Acceptance Criteria

1. THE Frontend_Client SHALL load the Supabase JavaScript client asynchronously to avoid blocking page render
2. THE Frontend_Client SHALL cache device list in sessionStorage for 5 minutes to reduce API calls
3. THE Frontend_Client SHALL implement pagination for incident lists when more than 50 incidents exist
4. THE Supabase_Database SHALL have indexes on frequently queried columns (email, device_code, incident_code, status)
5. THE Frontend_Client SHALL use Supabase query filters to fetch only necessary data (e.g., status = 'Open')
6. THE Frontend_Client SHALL implement lazy loading for incident details (fetch full details only when user clicks on an incident)
7. THE Frontend_Client SHALL debounce search inputs to avoid excessive API calls
8. THE Supabase_Database SHALL use connection pooling to handle concurrent requests efficiently
9. THE Frontend_Client SHALL display loading indicators during API calls to provide user feedback
10. THE Frontend_Client SHALL implement error retry logic with exponential backoff for failed API requests

### Requirement 17: Deployment and Configuration

**User Story:** As a system administrator, I want clear deployment instructions and configuration management, so that I can deploy and maintain the application easily.

#### Acceptance Criteria

1. THE Migration_System SHALL provide a README.md with step-by-step deployment instructions
2. THE Migration_System SHALL provide environment variable templates for Supabase URL and API keys
3. THE Frontend_Client SHALL read Supabase configuration from environment variables or a config file
4. THE Migration_System SHALL provide SQL scripts to create database tables, indexes, and RLS policies
5. THE Migration_System SHALL provide instructions for setting up Supabase Edge Functions for email processing
6. THE Migration_System SHALL provide instructions for configuring SMTP service for email sending
7. THE Migration_System SHALL provide instructions for setting up scheduled triggers for email queue processing
8. THE Migration_System SHALL document the process for generating and deploying QR codes for devices
9. THE Migration_System SHALL provide a testing checklist to verify all features after deployment
10. THE Migration_System SHALL provide rollback instructions in case deployment fails

### Requirement 18: Backward Compatibility and Transition

**User Story:** As a system administrator, I want a smooth transition from the old system to the new system, so that users experience minimal disruption.

#### Acceptance Criteria

1. THE Migration_System SHALL support running both Google Apps Script and Supabase systems in parallel during transition
2. THE Migration_System SHALL provide a feature flag to switch between old and new backends
3. THE Migration_System SHALL maintain the same URL structure for QR codes to avoid reprinting QR codes
4. THE Frontend_Client SHALL maintain the same UI/UX as the current system to minimize user retraining
5. THE Migration_System SHALL provide a data synchronization script to keep Google Sheets and Supabase in sync during transition
6. THE Migration_System SHALL provide user communication templates to announce the migration
7. THE Migration_System SHALL provide a rollback plan to revert to Google Apps Script if critical issues arise
8. THE Migration_System SHALL document differences in behavior between old and new systems
9. THE Migration_System SHALL provide training materials for users on any new features or changes
10. THE Migration_System SHALL schedule a maintenance window for the final cutover with minimal user impact
