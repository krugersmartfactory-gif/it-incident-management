# Hướng dẫn Quét QR Code và Hiển thị Thông tin Thiết bị

## Tổng quan
Khi quét QR code thiết bị, hệ thống sẽ hiển thị:
1. **Thông tin thiết bị**: Mã, tên, bộ phận, ngày mua, tuổi thiết bị, số lần sửa chữa
2. **Số đánh giá chưa hoàn thành**: Hiển thị số lượng sự cố đã xử lý nhưng chưa được đánh giá
3. **Danh sách đánh giá chưa hoàn thành**: Liệt kê các sự cố cần đánh giá

---

## Các thay đổi đã thực hiện

### 1. **CSS mới**
- Thêm `.device-page`, `.device-box`, `.device-info` cho Device Info Page
- Responsive design cho mobile và desktop

### 2. **HTML mới**
- Thêm `<div id="deviceInfoPage">` với:
  - Thông tin thiết bị (7 trường)
  - Danh sách đánh giá chưa hoàn thành
  - Form đăng nhập (ẩn ban đầu)

### 3. **JavaScript mới**
- `showDeviceInfoPage(deviceCode)` - Hiển thị trang thông tin thiết bị
- `loadUnratedIncidentsForDevice(deviceCode)` - Load đánh giá chưa hoàn thành
- `calculateDeviceAgeInMonths(purchaseDate)` - Tính tuổi thiết bị
- `handleDeviceLogin(event)` - Xử lý đăng nhập từ Device Info Page
- `showDeviceLoginForm()`, `cancelDeviceLogin()` - Quản lý form đăng nhập

### 4. **Logic xử lý URL**
- Khi URL có `?device=CODE` → Hiển thị Device Info Page
- Khi không có `?device` → Kiểm tra session bình thường

---

## Cách sử dụng

### 1. **Quét QR Code**
1. Mở app trên điện thoại
2. Quét QR code thiết bị (format: `https://it-incident-management.vercel.app/?device=DEVICE_CODE`)
3. Hệ thống tự động hiển thị Device Info Page

### 2. **Xem thông tin thiết bị**
- **Mã thiết bị**: Mã duy nhất của thiết bị
- **Tên thiết bị**: Tên mô tả thiết bị
- **Bộ phận**: Bộ phận sử dụng thiết bị
- **Ngày mua**: Ngày mua thiết bị
- **Tuổi thiết bị**: Số tháng kể từ ngày mua (tự động tính)
- **Lần sửa chữa**: Số lần thiết bị đã được sửa chữa (số sự cố đã xử lý)
- **Đánh giá chưa hoàn thành**: Số sự cố đã xử lý nhưng chưa được đánh giá (màu cam)

### 3. **Xem danh sách đánh giá chưa hoàn thành**
- Nếu có đánh giá chưa hoàn thành → Hiển thị danh sách với:
  - Mã sự cố
  - Mô tả ngắn gọn
  - Thông báo "Vui lòng đăng nhập để đánh giá"
- Nếu không có → Hiển thị "✅ Tất cả sự cố đã được đánh giá!"

### 4. **Đăng nhập để báo hỏng**
1. Click nút **"Đăng nhập ngay"**
2. Nhập email và mật khẩu
3. Sau khi đăng nhập thành công:
   - Chuyển sang Main App
   - Tự động chuyển đến tab "Báo hỏng"
   - Tự động điền mã thiết bị và tên thiết bị
   - Hiển thị thông báo "✅ Đã tải thông tin thiết bị: [CODE]"

---

## Kiểm tra tính năng

### Test 1: Quét QR code thiết bị có đánh giá chưa hoàn thành
1. Tạo sự cố cho thiết bị TEST001
2. Xử lý sự cố (status = "Đã xử lý")
3. KHÔNG đánh giá sự cố (rating = NULL)
4. Quét QR code: `https://it-incident-management.vercel.app/?device=TEST001`
5. **Kết quả mong đợi**:
   - Hiển thị "Đánh giá chưa hoàn thành: 1 sự cố" (màu cam)
   - Hiển thị danh sách sự cố chưa đánh giá

### Test 2: Quét QR code thiết bị không có đánh giá chưa hoàn thành
1. Đánh giá tất cả sự cố của thiết bị TEST002
2. Quét QR code: `https://it-incident-management.vercel.app/?device=TEST002`
3. **Kết quả mong đợi**:
   - Hiển thị "Đánh giá chưa hoàn thành: 0 sự cố"
   - Hiển thị "✅ Tất cả sự cố đã được đánh giá!"

### Test 3: Đăng nhập từ Device Info Page
1. Quét QR code thiết bị
2. Click "Đăng nhập ngay"
3. Nhập email và mật khẩu
4. **Kết quả mong đợi**:
   - Chuyển sang Main App
   - Tab "Báo hỏng" được chọn
   - Mã thiết bị và tên thiết bị đã được điền sẵn

### Test 4: Tính tuổi thiết bị
1. Thiết bị có `purchase_date = "2023-01-15"` (hoặc "15/01/2023")
2. Ngày hiện tại: 2026-04-29
3. **Kết quả mong đợi**: "39 tuổi" (39 tháng)

---

## Cấu trúc Database

### Bảng `incidents`
```sql
SELECT 
  incident_code,
  device_code,
  description,
  status,
  rating
FROM incidents
WHERE device_code = 'TEST001'
  AND status = 'Đã xử lý'
  AND rating IS NULL;
```

### Query đếm đánh giá chưa hoàn thành
```sql
SELECT COUNT(*) as unrated_count
FROM incidents
WHERE device_code = 'TEST001'
  AND status = 'Đã xử lý'
  AND rating IS NULL;
```

### Query đếm số lần sửa chữa
```sql
SELECT COUNT(*) as repair_count
FROM incidents
WHERE device_code = 'TEST001'
  AND status = 'Đã xử lý';
```

---

## Đẩy code lên GitHub và Vercel

### 1. Commit và push
```bash
git add .
git commit -m "Add Device Info Page with unrated incidents display"
git push origin main
```

### 2. Vercel tự động deploy
- Vercel sẽ tự động phát hiện thay đổi và deploy
- Không cần thao tác thủ công
- Kiểm tra tại: https://it-incident-management.vercel.app/

### 3. Test trên production
```
https://it-incident-management.vercel.app/?device=TEST001
```

---

## Lưu ý quan trọng

### ⚠️ Format ngày mua
- Hỗ trợ 2 format:
  - `YYYY-MM-DD` (ví dụ: "2023-01-15")
  - `DD/MM/YYYY` (ví dụ: "15/01/2023")
- Nếu format khác → Hiển thị "—"

### 🔢 Tính tuổi thiết bị
- Tính theo số tháng (không phải năm)
- Ví dụ: Mua ngày 15/01/2023, hôm nay 29/04/2026 → 39 tuổi (39 tháng)

### 📊 Đếm số lần sửa chữa
- Đếm số sự cố có `status = "Đã xử lý"`
- Không phân biệt đã đánh giá hay chưa

### ⭐ Đếm đánh giá chưa hoàn thành
- Đếm số sự cố có `status = "Đã xử lý"` VÀ `rating IS NULL`
- Hiển thị màu cam để thu hút sự chú ý

### 🔐 Đăng nhập từ Device Info Page
- Kiểm tra account lock (3 lần đăng nhập sai)
- Sau khi đăng nhập thành công → Tự động chuyển đến tab "Báo hỏng"
- Tự động điền mã thiết bị và tên thiết bị

---

## Xử lý lỗi

### Lỗi: "Không tìm thấy thiết bị"
**Nguyên nhân**: Mã thiết bị không tồn tại trong bảng `devices`

**Giải pháp**:
1. Kiểm tra bảng `devices`:
```sql
SELECT * FROM devices WHERE device_code = 'TEST001';
```
2. Nếu không có → Thêm thiết bị:
```sql
INSERT INTO devices (device_code, device_name, department, purchase_date)
VALUES ('TEST001', 'Máy tính TEST001', 'IT', '2023-01-15');
```

### Lỗi: "Đánh giá chưa hoàn thành: —"
**Nguyên nhân**: Lỗi khi query database

**Giải pháp**:
1. Mở Console (F12)
2. Xem lỗi trong tab Console
3. Kiểm tra RLS policies trong Supabase

---

## Tóm tắt

✅ **Đã thêm**:
- Device Info Page với 7 trường thông tin
- Hiển thị số đánh giá chưa hoàn thành (màu cam)
- Danh sách đánh giá chưa hoàn thành
- Tính tuổi thiết bị tự động
- Đăng nhập từ Device Info Page
- Tự động chuyển đến tab "Báo hỏng" sau khi đăng nhập

✅ **Tương thích**:
- Giống với Google Apps Script version
- Responsive design (mobile + desktop)
- Xử lý account lock (3 lần đăng nhập sai)

✅ **Sẵn sàng deploy**:
- Không cần migration SQL mới
- Chỉ cần push code lên GitHub
- Vercel tự động deploy
