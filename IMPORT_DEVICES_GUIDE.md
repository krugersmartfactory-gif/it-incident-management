# Hướng dẫn thêm thiết bị vào hệ thống

## Cách 1: Thêm từng thiết bị qua Supabase Dashboard

1. Mở Supabase Dashboard → Table Editor
2. Chọn bảng `devices`
3. Bấm "Insert" → "Insert row"
4. Điền thông tin:
   - `device_code`: TH141 (bắt buộc, unique)
   - `device_name`: Máy tính TH141 (bắt buộc)
   - `device_type`: Computer / Printer / Projector / etc.
   - `location`: Phòng IT
   - `purchase_date`: 2024-01-01
   - `status`: Active
5. Bấm "Save"

## Cách 2: Import hàng loạt bằng SQL

Chạy SQL này trong Supabase SQL Editor:

```sql
INSERT INTO public.devices (device_code, device_name, device_type, location, purchase_date, status) VALUES
('TH141', 'Máy tính TH141', 'Computer', 'Phòng IT', '2024-01-01', 'Active'),
('TH142', 'Máy tính TH142', 'Computer', 'Phòng Kế toán', '2024-01-01', 'Active'),
('TH143', 'Máy tính TH143', 'Computer', 'Phòng Nhân sự', '2024-01-01', 'Active'),
('PRINTER-01', 'Máy in HP LaserJet', 'Printer', 'Phòng Hành chính', '2024-01-01', 'Active'),
('PROJECTOR-01', 'Máy chiếu Epson', 'Projector', 'Phòng họp A', '2024-01-01', 'Active')
ON CONFLICT (device_code) DO NOTHING;
```

## Cách 3: Import từ file CSV

### Bước 1: Tạo file CSV

Tạo file `devices.csv` với nội dung:

```csv
device_code,device_name,device_type,location,purchase_date,status
TH141,Máy tính TH141,Computer,Phòng IT,2024-01-01,Active
TH142,Máy tính TH142,Computer,Phòng Kế toán,2024-01-01,Active
TH143,Máy tính TH143,Computer,Phòng Nhân sự,2024-01-01,Active
PRINTER-01,Máy in HP LaserJet,Printer,Phòng Hành chính,2024-01-01,Active
PROJECTOR-01,Máy chiếu Epson,Projector,Phòng họp A,2024-01-01,Active
```

### Bước 2: Import vào Supabase

1. Mở Supabase Dashboard → Table Editor
2. Chọn bảng `devices`
3. Bấm "..." (menu) → "Import data from CSV"
4. Chọn file `devices.csv`
5. Map các cột đúng
6. Bấm "Import"

## Cách 4: Dùng script Node.js (Nếu có nhiều thiết bị)

Tạo file `import-devices.js`:

```javascript
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_CONFIG = require('./config.js');

const supabase = createClient(SUPABASE_CONFIG.url, 'YOUR_SERVICE_ROLE_KEY');

const devices = [
  { device_code: 'TH141', device_name: 'Máy tính TH141', device_type: 'Computer', location: 'Phòng IT', purchase_date: '2024-01-01', status: 'Active' },
  { device_code: 'TH142', device_name: 'Máy tính TH142', device_type: 'Computer', location: 'Phòng Kế toán', purchase_date: '2024-01-01', status: 'Active' },
  // Thêm thiết bị khác...
];

async function importDevices() {
  const { data, error } = await supabase
    .from('devices')
    .upsert(devices, { onConflict: 'device_code' });
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('✅ Imported', devices.length, 'devices');
  }
}

importDevices();
```

Chạy:
```bash
node import-devices.js
```

## Mẫu dữ liệu thiết bị

| device_code | device_name | device_type | location | purchase_date | status |
|-------------|-------------|-------------|----------|---------------|--------|
| TH141 | Máy tính TH141 | Computer | Phòng IT | 2024-01-01 | Active |
| TH142 | Máy tính TH142 | Computer | Phòng Kế toán | 2024-01-01 | Active |
| PRINTER-01 | Máy in HP LaserJet | Printer | Phòng Hành chính | 2024-01-01 | Active |
| PROJECTOR-01 | Máy chiếu Epson | Projector | Phòng họp A | 2024-01-01 | Active |

## Lưu ý

- `device_code` phải **UNIQUE** (không trùng)
- `device_code` và `device_name` là **BẮT BUỘC**
- Các trường khác có thể để trống
- Sau khi thêm thiết bị, quét QR sẽ tự động điền tên thiết bị

## Kiểm tra

Sau khi thêm thiết bị, kiểm tra bằng SQL:

```sql
SELECT * FROM public.devices WHERE device_code = 'TH141';
```

Hoặc quét lại QR code để xem tên thiết bị có tự động điền không.
