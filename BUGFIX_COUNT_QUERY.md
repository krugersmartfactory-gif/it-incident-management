# Bugfix: Lỗi Count Query trong Supabase

## Vấn đề

Khi quét QR code, Device Info Page hiển thị lỗi:
```
Lỗi: Không tìm thấy thiết bị
```

Console log hiển thị:
```
Failed to load resource: the server responded with a status of 400 ()
```

---

## Nguyên nhân

Code tối ưu đã sử dụng cú pháp sai cho count query:

### ❌ **Code lỗi**
```javascript
const repairCountPromise = supabaseClient
  .from('incidents')
  .select('id', { count: 'exact', head: true })  // ❌ head: true không hợp lệ
  .eq('device_code', deviceCode)
  .eq('status', 'Đã xử lý');
```

**Vấn đề**: 
- `head: true` không phải là option hợp lệ trong Supabase JS Client v2
- Gây lỗi 400 Bad Request
- Promise.all() fail → Tất cả data không load được

---

## Giải pháp

### ✅ **Code đúng**
```javascript
const repairCountPromise = supabaseClient
  .from('incidents')
  .select('id', { count: 'exact' })  // ✅ Chỉ cần count: 'exact'
  .eq('device_code', deviceCode)
  .eq('status', 'Đã xử lý');
```

**Giải thích**:
- `{ count: 'exact' }` là đủ để lấy count
- Supabase sẽ trả về `{ data: [...], count: 5 }`
- Không cần `head: true`

---

## Cách sử dụng Count trong Supabase JS v2

### 1. **Count với data**
```javascript
const { data, count, error } = await supabaseClient
  .from('incidents')
  .select('*', { count: 'exact' })
  .eq('device_code', 'TEST001');

console.log('Count:', count);  // 5
console.log('Data:', data);    // [{ id: 1, ... }, ...]
```

### 2. **Count only (không cần data)**
```javascript
const { count, error } = await supabaseClient
  .from('incidents')
  .select('*', { count: 'exact', head: true })  // ❌ KHÔNG HOẠT ĐỘNG trong JS Client v2
  .eq('device_code', 'TEST001');
```

**Lưu ý**: `head: true` chỉ hoạt động trong REST API, không phải JS Client v2.

### 3. **Count với ít data hơn**
```javascript
// Tốt nhất: Chỉ select 1 column nhẹ
const { data, count, error } = await supabaseClient
  .from('incidents')
  .select('id', { count: 'exact' })  // Chỉ select id (nhẹ)
  .eq('device_code', 'TEST001');

console.log('Count:', count);  // 5
console.log('Data:', data);    // [{ id: 1 }, { id: 2 }, ...]
```

---

## Testing

### Test 1: Kiểm tra count query
```javascript
// Mở Console (F12)
const { data, count, error } = await supabaseClient
  .from('incidents')
  .select('id', { count: 'exact' })
  .eq('device_code', 'TEST001')
  .eq('status', 'Đã xử lý');

console.log('Count:', count);
console.log('Error:', error);
```

**Kết quả mong đợi**:
```
Count: 5
Error: null
```

### Test 2: Quét QR code
```
https://it-incident-management.vercel.app/?device=TEST001
```

**Kết quả mong đợi**:
- Hiển thị device code: TEST001
- Hiển thị tên thiết bị, bộ phận, ngày mua
- Hiển thị "Lần sửa chữa: 5 lần"
- Hiển thị "Đánh giá chưa hoàn thành: X sự cố"

---

## Tài liệu tham khảo

### Supabase JS Client v2 - Count
https://supabase.com/docs/reference/javascript/select#with-count-option

```javascript
// Correct syntax
const { data, count } = await supabase
  .from('cities')
  .select('name', { count: 'exact' })
```

### Supabase REST API - Head
https://supabase.com/docs/reference/javascript/select#head-option

**Lưu ý**: `head: true` chỉ có trong REST API, không có trong JS Client v2.

---

## Tóm tắt

### ❌ **Lỗi**
```javascript
.select('id', { count: 'exact', head: true })  // head: true không hợp lệ
```

### ✅ **Sửa**
```javascript
.select('id', { count: 'exact' })  // Bỏ head: true
```

### 📊 **Kết quả**
- ✅ Count query hoạt động đúng
- ✅ Device Info Page load thành công
- ✅ Hiển thị đầy đủ thông tin thiết bị
- ✅ Không còn lỗi 400 Bad Request

---

## Commit message
```
Fix: Remove invalid 'head: true' option from count query in Supabase JS Client v2
```
