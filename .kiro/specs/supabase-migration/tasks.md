# Implementation Plan: Supabase Migration

## Overview

Migration từ Google Apps Script + Google Sheets sang Supabase (PostgreSQL + Edge Functions + Auth). Dự án bao gồm 4 phases chính: Setup, Database Migration, Frontend Integration, và Testing & Deployment.

**Mục tiêu:**
- Zero data loss
- 100% feature parity
- Giữ nguyên UI/UX
- Cải thiện performance và scalability

## Tasks

- [ ] 1. Phase 1: Supabase Project Setup
  - [ ] 1.1 Tạo Supabase project và cấu hình cơ bản
    - Tạo project trên Supabase Dashboard (region: Southeast Asia)
    - Lưu lại Project URL, Anon Key, Service Role Key
    - Cấu hình environment variables
    - _Requirements: 17.2, 17.3_
  
  - [ ] 1.2 Tạo database schema (tables)
    - Tạo bảng `users` với đầy đủ columns và constraints
    - Tạo bảng `devices` với đầy đủ columns và constraints
    - Tạo bảng `incidents` với đầy đủ columns và constraints
    - Tạo bảng `email_queue` với đầy đủ columns và constraints
    - Tạo indexes cho các columns thường xuyên query
    - Tạo foreign key relationships
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.9, 1.10_
  
  - [ ] 1.3 Tạo database functions và triggers
    - Tạo function `update_updated_at_column()` cho auto-update timestamps
    - Tạo function `generate_incident_code()` để tạo mã sự cố unique
    - Tạo function `calculate_device_age_months()` để tính tuổi thiết bị
    - Tạo function `count_device_repairs()` để đếm số lần sửa chữa
    - Tạo triggers cho các bảng để auto-update `updated_at`
    - _Requirements: 1.9_
  
  - [ ] 1.4 Implement Row Level Security (RLS) policies
    - Enable RLS trên tất cả các bảng
    - Tạo RLS policy cho bảng `users` (users chỉ đọc được record của mình)
    - Tạo RLS policy cho bảng `devices` (authenticated users đọc được tất cả)
    - Tạo RLS policy cho bảng `incidents` (read all, insert all, update theo permission)
    - Tạo RLS policy cho bảng `email_queue` (chỉ service role)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10_

- [ ] 2. Checkpoint - Verify database setup
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Phase 2: Data Migration from Google Sheets
  - [ ] 3.1 Tạo migration script để export data từ Google Sheets
    - Setup Google Sheets API authentication (service account)
    - Viết script để đọc dữ liệu từ sheet "user"
    - Viết script để đọc dữ liệu từ sheet "danh sách thiết bị"
    - Viết script để đọc dữ liệu từ sheet "Incident Log"
    - Viết script để đọc dữ liệu từ sheet "EMAIL_QUEUE"
    - _Requirements: 14.1, 14.2_
  
  - [ ] 3.2 Transform và validate data
    - Transform user data: map columns, convert date formats
    - Transform device data: map columns, convert date formats
    - Transform incident data: map columns, convert timestamps
    - Transform email queue data: map columns, convert timestamps
    - Validate data types và constraints
    - Handle missing values và data cleaning
    - _Requirements: 14.3, 14.4, 14.5, 14.6, 14.8_
  
  - [ ] 3.3 Migrate users sang Supabase Auth
    - Tạo Supabase Auth users từ Google Sheets user data
    - Set temporary password cho tất cả users (users sẽ reset sau)
    - Insert user profiles vào bảng `users` với UUID từ Supabase Auth
    - Map user metadata (name, department, access_role, form_access)
    - _Requirements: 2.9, 14.3_
  
  - [ ] 3.4 Import data vào Supabase PostgreSQL
    - Import devices data vào bảng `devices`
    - Import incidents data vào bảng `incidents`
    - Import email queue data vào bảng `email_queue`
    - Handle duplicate keys và conflicts
    - _Requirements: 1.5, 1.6, 1.7, 1.8, 14.7_
  
  - [ ] 3.5 Verify data integrity sau migration
    - So sánh row counts giữa Google Sheets và Supabase
    - Verify foreign key relationships
    - Verify data types và formats
    - Check for missing hoặc corrupted data
    - Log migration errors và warnings
    - _Requirements: 14.9, 14.10_

- [ ] 4. Checkpoint - Verify data migration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Phase 3: Frontend Integration với Supabase
  - [ ] 5.1 Setup Supabase JavaScript Client trong frontend
    - Thêm Supabase JS library vào index.html
    - Initialize Supabase client với Project URL và Anon Key
    - Setup configuration management (environment variables)
    - _Requirements: 12.1, 17.3_
  
  - [ ] 5.2 Implement authentication functions
    - Viết function `handleLogin()` sử dụng `supabase.auth.signInWithPassword()`
    - Viết function `handleLogout()` sử dụng `supabase.auth.signOut()`
    - Viết function `checkSession()` để validate session on page load
    - Viết function `handleChangePassword()` sử dụng `supabase.auth.updateUser()`
    - Implement session storage management (access token, refresh token)
    - Implement auto token refresh với `onAuthStateChange()`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 12.2, 12.3, 12.4_
  
  - [ ] 5.3 Implement user authorization và permissions
    - Fetch user profile từ bảng `users` sau login
    - Store user permissions (access_role, form_access) trong sessionStorage
    - Implement function `applyFormAccessPermissions()` để ẩn/hiện tabs
    - Verify permissions trước khi thực hiện operations
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  
  - [ ] 5.4 Implement device management functions
    - Viết function `getDeviceList()` sử dụng `supabase.from('devices').select()`
    - Viết function `getDeviceInfo()` để fetch device by code (case-insensitive)
    - Viết function `calculateDeviceAgeMonths()` để tính tuổi thiết bị
    - Implement device caching trong sessionStorage
    - Handle QR code URL parameters (?id=deviceCode)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 12.5_
  
  - [ ] 5.5 Implement incident submission functions
    - Viết function `submitIncident()` với validation
    - Call database function `generate_incident_code()` để tạo mã sự cố
    - Insert incident vào bảng `incidents` sử dụng `supabase.from('incidents').insert()`
    - Enqueue email notification vào bảng `email_queue`
    - Handle concurrent submissions và unique constraint violations
    - Display success message với incident code
    - Reset form sau successful submission
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 12.6_
  
  - [ ] 5.6 Implement incident resolution functions
    - Viết function `getOpenIncidents()` để fetch incidents với status "Open"
    - Display open incidents trong table với action buttons
    - Viết function `resolveIncident()` để update incident status sang "Closed"
    - Update resolver, resolution, root_cause, resolve_date fields
    - Enqueue resolution email notification
    - Refresh incidents list sau successful resolution
    - Prevent resolving already closed incidents
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 12.7_
  
  - [ ] 5.7 Implement incident rating functions
    - Viết function `getUnratedIncidentsByDevice()` để fetch unrated incidents
    - Display unrated incidents list với incident details
    - Implement star rating UI với labels (1-5 stars)
    - Viết function `rateIncident()` để update rating, rater_name, attitude_comment
    - Validate rating value (1-5) trước khi submit
    - Refresh unrated incidents list sau successful rating
    - Prevent rating incidents that are not "Closed"
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 12.8_
  
  - [ ] 5.8 Implement email queue functions
    - Viết function `enqueueIncidentEmail()` để insert email vào queue
    - Viết function `buildIncidentEmailHtml()` để tạo HTML email content
    - Viết function `enqueueResolutionEmail()` cho resolution notifications
    - Insert email records với status "PENDING"
    - _Requirements: 8.1, 8.2, 12.9_
  
  - [ ] 5.9 Implement error handling và retry logic
    - Viết centralized error handler `handleSupabaseError()`
    - Map Supabase error codes sang user-friendly messages (tiếng Việt)
    - Implement retry logic cho network errors với exponential backoff
    - Handle session expiration và auto-refresh tokens
    - Handle RLS policy violations và permission errors
    - Handle database constraint violations (unique, foreign key)
    - Implement client-side error logging
    - _Requirements: 12.10_

- [ ] 6. Checkpoint - Verify frontend integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Phase 4: Email Service Implementation
  - [ ] 7.1 Tạo Supabase Edge Function cho email processing
    - Tạo file `supabase/functions/process-email-queue/index.ts`
    - Implement function để fetch pending emails từ `email_queue` table
    - Implement retry logic (max 3 retries)
    - Update email status (PENDING → SENT/FAILED/DEAD)
    - Log errors vào `error_log` column
    - _Requirements: 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_
  
  - [ ] 7.2 Integrate SMTP service (SendGrid hoặc Resend)
    - Setup SendGrid hoặc Resend API key
    - Implement function `sendEmail()` sử dụng SMTP API
    - Handle email sending errors và retries
    - Support TO, CC email addresses
    - Send HTML email content
    - _Requirements: 8.10_
  
  - [ ] 7.3 Setup scheduled trigger cho email processing
    - Option 1: Setup pg_cron trong Supabase
    - Option 2: Setup GitHub Actions workflow
    - Option 3: Implement webhook trigger từ frontend
    - Schedule email processor chạy mỗi 1 phút
    - _Requirements: 8.4_
  
  - [ ] 7.4 Configure environment variables cho Edge Function
    - Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
    - Set SENDGRID_API_KEY hoặc RESEND_API_KEY
    - Set SMTP credentials (nếu dùng SMTP)
    - _Requirements: 17.2_
  
  - [ ] 7.5 Deploy Edge Function lên Supabase
    - Deploy function sử dụng Supabase CLI
    - Test function với sample email
    - Verify email delivery
    - Monitor function logs
    - _Requirements: 17.5_

- [ ] 8. Checkpoint - Verify email service
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Phase 5: Testing và Quality Assurance
  - [ ]* 9.1 Write unit tests cho authentication functions
    - Test login với valid credentials
    - Test login với invalid credentials
    - Test password change
    - Test session validation
    - Test logout
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_
  
  - [ ]* 9.2 Write unit tests cho device operations
    - Test getDeviceList()
    - Test getDeviceInfo() với valid device code
    - Test getDeviceInfo() với invalid device code
    - Test calculateDeviceAgeMonths()
    - Test device caching
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  
  - [ ]* 9.3 Write unit tests cho incident operations
    - Test submitIncident() với valid data
    - Test submitIncident() với invalid severity
    - Test resolveIncident()
    - Test rateIncident()
    - Test getOpenIncidents()
    - Test getUnratedIncidentsByDevice()
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_
  
  - [ ]* 9.4 Write integration tests cho end-to-end flows
    - Test complete incident lifecycle (submit → resolve → rate)
    - Test QR code scan → device info → login → submit incident
    - Test authentication → permission check → data access
    - Test email queue processing (PENDING → SENT)
    - Test concurrent incident submissions
    - _Requirements: All requirements_
  
  - [ ]* 9.5 Write database tests cho RLS policies
    - Test users RLS policy (read own record only)
    - Test devices RLS policy (authenticated users read all)
    - Test incidents RLS policy (read all, insert all, update by permission)
    - Test email_queue RLS policy (service role only)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10_
  
  - [ ]* 9.6 Write performance tests
    - Test 100 concurrent incident submissions
    - Test database query performance (< 500ms)
    - Test email queue processing (1000 emails)
    - Measure page load time
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.10_
  
  - [ ] 9.7 Perform User Acceptance Testing (UAT)
    - Test QR code scanning và device info display
    - Test user login và logout
    - Test incident submission
    - Test incident resolution
    - Test incident rating
    - Test password change
    - Test email notifications
    - Verify UI/UX matches current system
    - _Requirements: All requirements_
  
  - [ ]* 9.8 Perform regression testing
    - Verify incident code format matches (INC-YYYY-XXX)
    - Verify device age calculation matches
    - Verify email HTML format matches
    - Verify QR code URLs backward compatibility
    - Verify data integrity
    - _Requirements: 18.3, 18.4_

- [ ] 10. Checkpoint - Verify all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Phase 6: Deployment và Cutover
  - [ ] 11.1 Prepare deployment documentation
    - Write README.md với deployment instructions
    - Document environment variables
    - Document database setup steps
    - Document Edge Function deployment
    - Document SMTP configuration
    - Document QR code generation process
    - Create testing checklist
    - Create rollback plan
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10_
  
  - [ ] 11.2 Deploy lên staging environment
    - Deploy database schema lên staging Supabase project
    - Deploy Edge Functions lên staging
    - Deploy frontend lên staging (hoặc update Google Apps Script)
    - Configure staging environment variables
    - _Requirements: 17.1, 17.2, 17.3_
  
  - [ ] 11.3 Perform staging testing
    - Run full UAT test suite trên staging
    - Test email delivery trên staging
    - Test QR code scanning trên staging
    - Verify performance trên staging
    - Fix any issues found
    - _Requirements: All requirements_
  
  - [ ] 11.4 Prepare production cutover plan
    - Schedule maintenance window
    - Prepare user communication templates
    - Setup data synchronization script (nếu cần parallel operation)
    - Prepare rollback procedures
    - _Requirements: 18.1, 18.2, 18.5, 18.6, 18.7_
  
  - [ ] 11.5 Deploy lên production environment
    - Deploy database schema lên production Supabase project
    - Migrate production data từ Google Sheets
    - Deploy Edge Functions lên production
    - Deploy frontend lên production
    - Configure production environment variables
    - Update QR code URLs (nếu cần)
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8_
  
  - [ ] 11.6 Perform production smoke testing
    - Test login với production users
    - Test incident submission
    - Test email delivery
    - Test QR code scanning
    - Verify data integrity
    - _Requirements: All requirements_
  
  - [ ] 11.7 Monitor production system
    - Monitor Supabase database performance
    - Monitor Edge Function execution
    - Monitor email delivery rates
    - Monitor error logs
    - Monitor user feedback
    - _Requirements: 17.9_
  
  - [ ] 11.8 Provide user training và support
    - Send user communication về migration
    - Provide training materials (nếu có thay đổi)
    - Setup support channel cho user questions
    - Monitor user issues và feedback
    - _Requirements: 18.6, 18.9_

- [ ] 12. Final Checkpoint - Production verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Migration strategy follows phased approach: Setup → Data → Frontend → Email → Testing → Deployment
- Backward compatibility maintained for QR code URLs (no reprinting needed)
- Parallel operation supported during transition period if needed
- Rollback plan available in case of critical issues
