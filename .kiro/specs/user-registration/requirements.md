# Tài Liệu Yêu Cầu: Đăng Ký Tài Khoản Người Dùng

## Giới Thiệu

Tính năng đăng ký tài khoản cho phép người dùng mới tự tạo tài khoản trong hệ thống IT Incident Management mà không cần Admin can thiệp. Hiện tại, hệ thống chỉ có chức năng đăng nhập và Admin phải tạo tài khoản thủ công qua Supabase Dashboard. Tính năng này sẽ tự động hóa quy trình đăng ký và tích hợp với hệ thống account lock hiện có (3 lần đăng nhập sai = khóa vĩnh viễn).

## Bảng Thuật Ngữ

- **Registration_Form**: Form đăng ký tài khoản người dùng mới
- **Auth_System**: Hệ thống xác thực của Supabase (auth.users)
- **Profile_System**: Hệ thống quản lý thông tin người dùng (public.users)
- **Email_Validator**: Bộ kiểm tra tính hợp lệ của địa chỉ email
- **Password_Validator**: Bộ kiểm tra độ mạnh của mật khẩu
- **Account_Lock_System**: Hệ thống khóa tài khoản sau 3 lần đăng nhập sai
- **Email_Verification_System**: Hệ thống xác thực email qua link kích hoạt
- **Login_Page**: Trang đăng nhập hiện tại của hệ thống

## Yêu Cầu

### Yêu Cầu 1: Hiển Thị Form Đăng Ký

**User Story:** Là một người dùng mới, tôi muốn thấy link đăng ký trên trang đăng nhập, để tôi có thể tạo tài khoản mới.

#### Tiêu Chí Chấp Nhận

1. THE Login_Page SHALL hiển thị link "Đăng ký tài khoản mới" dưới form đăng nhập
2. WHEN người dùng click vào link đăng ký, THE Login_Page SHALL hiển thị Registration_Form
3. THE Registration_Form SHALL chứa các trường: Email, Mật khẩu, Xác nhận mật khẩu, Họ tên, Bộ phận, Số điện thoại
4. THE Registration_Form SHALL có nút "Đăng ký" và nút "Quay lại đăng nhập"
5. WHEN người dùng click "Quay lại đăng nhập", THE Registration_Form SHALL ẩn và hiển thị lại form đăng nhập

### Yêu Cầu 2: Kiểm Tra Tính Hợp Lệ Của Email

**User Story:** Là một người dùng, tôi muốn hệ thống kiểm tra email hợp lệ, để tránh nhập sai địa chỉ email.

#### Tiêu Chí Chấp Nhận

1. WHEN người dùng nhập email, THE Email_Validator SHALL kiểm tra định dạng email hợp lệ
2. IF email không đúng định dạng, THEN THE Registration_Form SHALL hiển thị thông báo lỗi "Email không hợp lệ"
3. WHEN người dùng submit form với email đã tồn tại, THE Auth_System SHALL trả về lỗi và THE Registration_Form SHALL hiển thị "Email đã được đăng ký"
4. THE Email_Validator SHALL chấp nhận email có định dạng chuẩn RFC 5322

### Yêu Cầu 3: Kiểm Tra Độ Mạnh Mật Khẩu

**User Story:** Là một người dùng, tôi muốn hệ thống yêu cầu mật khẩu mạnh, để bảo vệ tài khoản của tôi.

#### Tiêu Chí Chấp Nhận

1. THE Password_Validator SHALL yêu cầu mật khẩu có ít nhất 8 ký tự
2. THE Password_Validator SHALL yêu cầu mật khẩu chứa ít nhất 1 chữ hoa
3. THE Password_Validator SHALL yêu cầu mật khẩu chứa ít nhất 1 chữ thường
4. THE Password_Validator SHALL yêu cầu mật khẩu chứa ít nhất 1 số
5. IF mật khẩu không đáp ứng yêu cầu, THEN THE Registration_Form SHALL hiển thị thông báo lỗi cụ thể
6. WHEN người dùng nhập xác nhận mật khẩu không khớp, THE Registration_Form SHALL hiển thị "Mật khẩu xác nhận không khớp"

### Yêu Cầu 4: Tạo Tài Khoản Trong Auth System

**User Story:** Là một người dùng, tôi muốn tạo tài khoản xác thực, để có thể đăng nhập vào hệ thống.

#### Tiêu Chí Chấp Nhận

1. WHEN người dùng submit form đăng ký hợp lệ, THE Registration_Form SHALL gọi Supabase Auth API để tạo tài khoản
2. THE Auth_System SHALL tạo bản ghi mới trong bảng auth.users với email và mật khẩu đã mã hóa
3. IF việc tạo tài khoản thất bại, THEN THE Registration_Form SHALL hiển thị thông báo lỗi từ Auth_System
4. WHEN tài khoản được tạo thành công, THE Auth_System SHALL trả về user ID

### Yêu Cầu 5: Tạo Profile Người Dùng

**User Story:** Là một người dùng, tôi muốn thông tin cá nhân được lưu trữ, để hệ thống biết tôi là ai.

#### Tiêu Chí Chấp Nhận

1. WHEN Auth_System tạo tài khoản thành công, THE Profile_System SHALL tự động tạo bản ghi trong bảng public.users
2. THE Profile_System SHALL lưu các trường: id (từ auth.users), email, name, department, phone
3. THE Profile_System SHALL đặt giá trị mặc định: access_role = 'user', form_access = 'báo hỏng, xử lý, đánh giá', is_locked = FALSE, is_admin = FALSE
4. IF việc tạo profile thất bại, THEN THE Registration_Form SHALL xóa tài khoản auth đã tạo và hiển thị thông báo lỗi
5. WHEN profile được tạo thành công, THE Registration_Form SHALL hiển thị thông báo "Đăng ký thành công"

### Yêu Cầu 6: Xác Thực Email (Tùy Chọn)

**User Story:** Là một quản trị viên, tôi muốn có thể bật/tắt xác thực email, để kiểm soát quy trình đăng ký.

#### Tiêu Chí Chấp Nhận

1. WHERE xác thực email được bật, THE Auth_System SHALL gửi email xác thực đến địa chỉ email đã đăng ký
2. WHERE xác thực email được bật, THE Auth_System SHALL đặt trạng thái email_confirmed = FALSE
3. WHERE xác thực email được bật, WHEN người dùng click link xác thực, THE Auth_System SHALL đặt email_confirmed = TRUE
4. WHERE xác thực email được tắt, THE Auth_System SHALL tự động đặt email_confirmed = TRUE
5. WHERE xác thực email được bật, IF người dùng chưa xác thực email, THEN THE Login_Page SHALL hiển thị thông báo "Vui lòng xác thực email trước khi đăng nhập"

### Yêu Cầu 7: Tích Hợp Với Account Lock System

**User Story:** Là một người dùng mới, tôi muốn tài khoản của tôi được bảo vệ bởi hệ thống khóa tài khoản, để ngăn chặn truy cập trái phép.

#### Tiêu Chí Chấp Nhận

1. WHEN Profile_System tạo bản ghi mới, THE Profile_System SHALL đặt is_locked = FALSE
2. WHEN người dùng mới đăng nhập sai 3 lần, THE Account_Lock_System SHALL đặt is_locked = TRUE trong bảng public.users
3. THE Account_Lock_System SHALL ghi lại lý do khóa: locked_reason = 'Đăng nhập sai 3 lần'
4. THE Account_Lock_System SHALL ghi lại thời gian khóa: locked_at = NOW()
5. IF tài khoản bị khóa, THEN THE Login_Page SHALL hiển thị "Tài khoản đã bị khóa. Vui lòng liên hệ Admin để mở khóa"

### Yêu Cầu 8: Hiển Thị Thông Báo Thành Công

**User Story:** Là một người dùng, tôi muốn biết đăng ký thành công, để có thể đăng nhập ngay.

#### Tiêu Chí Chấp Nhận

1. WHEN đăng ký thành công, THE Registration_Form SHALL hiển thị thông báo "Đăng ký thành công! Bạn có thể đăng nhập ngay bây giờ"
2. WHERE xác thực email được bật, THE Registration_Form SHALL hiển thị "Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản"
3. WHEN đăng ký thành công, THE Registration_Form SHALL tự động chuyển về form đăng nhập sau 3 giây
4. THE Registration_Form SHALL tự động điền email vào form đăng nhập sau khi đăng ký thành công

### Yêu Cầu 9: Xử Lý Lỗi Và Thông Báo

**User Story:** Là một người dùng, tôi muốn nhận thông báo lỗi rõ ràng, để biết cách khắc phục.

#### Tiêu Chí Chấp Nhận

1. IF có lỗi xảy ra, THEN THE Registration_Form SHALL hiển thị thông báo lỗi màu đỏ
2. THE Registration_Form SHALL hiển thị thông báo lỗi cụ thể cho từng trường hợp: email không hợp lệ, mật khẩu yếu, email đã tồn tại, lỗi kết nối
3. WHEN người dùng sửa lỗi và submit lại, THE Registration_Form SHALL xóa thông báo lỗi cũ
4. IF lỗi kết nối xảy ra, THEN THE Registration_Form SHALL hiển thị "Không thể kết nối đến server. Vui lòng thử lại sau"

### Yêu Cầu 10: Bảo Mật Và Validation

**User Story:** Là một quản trị viên, tôi muốn hệ thống đăng ký an toàn, để ngăn chặn tấn công và spam.

#### Tiêu Chí Chấp Nhận

1. THE Registration_Form SHALL validate tất cả input ở phía client trước khi gửi request
2. THE Auth_System SHALL validate tất cả input ở phía server
3. THE Registration_Form SHALL không hiển thị mật khẩu dưới dạng plain text (sử dụng type="password")
4. THE Registration_Form SHALL có nút hiển thị/ẩn mật khẩu (toggle password visibility)
5. THE Auth_System SHALL mã hóa mật khẩu trước khi lưu vào database
6. THE Registration_Form SHALL ngăn chặn submit nhiều lần (disable button sau khi click)
