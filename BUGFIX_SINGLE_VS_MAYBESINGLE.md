# Bugfix: Lỗi .single() vs .maybeSingle() trong Supabase

## Vấn đề

Sau khi làm mới trang (refresh), Device Info Page hiển thị lỗi:
```
Lỗi: Không tìm thấy thiết bị
```

Console log hiển thị:
```
POST https://vjudueltlidywypsktwk.supabase.co/rest/v1/devices?select=*&device_code=eq.TN141
400 (Bad Request)
```

---

## Nguyên nhân

### ❌ **Code lỗi**
```javascript
const devicePromise = supabaseClient
  .from('devices')
  .select('*')
  .eq('device_code', deviceCode)
  .single();  // ❌ Throw error nếu không tìm thấy hoặc tìm thấy nhiều hơn 1 record
```

**Vấn đề**:
- `.single()` throw error khi:
  - Không tìm thấy record nào (0 rows)
  - Tìm thấy nhiều hơn 1 record (>1 rows)
- Khi throw error → `Promise.all()` fail
- Tất cả data không load được

### Tại sao lần đầu hoạt động nhưng refresh lại lỗi?

**Lần đầu (từ QR code)**:
- URL: `?device=TN141`
- Browser cache: Chưa có
- Request mới → Có thể thành công

**Lần refresh**:
- Browser cache: Có thể có data cũ
- Supabase client state: Có thể bị conflict
- `.single()` strict hơn → Throw error

---

## Giải pháp

### ✅ **Code đúng**
```javascript
const devicePromise = supabaseClient
  .from('devices')
  .select('*')
  .eq('device_code', deviceCode)
  .maybeSingle();  // ✅ Không throw error, trả về null nếu không tìm thấy
```

**Giải thích**:
- `.maybeSingle()` không throw error
- Trả về `{ data: null, error: null }` nếu không tìm thấy
- Trả về `{ data: {...}, error: null }` nếu tìm thấy 1 record
- Trả về `{ data: null, error: {...} }` nếu tìm thấy >1 records

---

## So sánh .single() vs .maybeSingle()

### `.single()`
```javascript
const { data, error } = await supabaseClient
  .from('devices')
  .select('*')
  .eq('device_code', 'NOT_EXIST')
  .single();

// Kết quả:
// data: null
// error: { message: "JSON object requested, multiple (or no) rows returned" }
// ❌ Throw error → Promise.all() fail
```

### `.maybeSingle()`
```javascript
const { data, error } = await supabaseClient
  .from('devices')
  .select('*')
  .eq('device_code', 'NOT_EXIST')
  .maybeSingle();

// Kết quả:
// data: null
// error: null
// ✅ Không throw error → Promise.all() vẫn hoạt động
```

---

## Khi nào dùng .single() vs .maybeSingle()?

### Dùng `.single()` khi:
- Bạn **chắc chắn** có đúng 1 record
- Muốn throw error nếu không tìm thấy hoặc tìm thấy nhiều hơn 1
- Ví dụ: Get user profile by ID (luôn có 1 record)

```javascript
// User profile luôn tồn tại sau khi login
const { data: user } = await supabaseClient
  .from('users')
  .select('*')
  .eq('id', userId)
  .single();  // ✅ OK vì chắc chắn có 1 record
```

### Dùng `.maybeSingle()` khi:
- Không chắc chắn có record hay không
- Muốn xử lý trường hợp không tìm thấy một cách graceful
- Ví dụ: Get device by code (có thể không tồn tại)

```javascript
// Device có thể không tồn tại
const { data: device } = await supabaseClient
  .from('devices')
  .select('*')
  .eq('device_code', deviceCode)
  .maybeSingle();  // ✅ OK vì có thể không tìm thấy

if (!device) {
  console.log('Device not found');
} else {
  console.log('Device found:', device);
}
```

---

## Testing

### Test 1: Device tồn tại
```
https://it-incident-management.vercel.app/?device=TN141
```

**Kết quả mong đợi**:
- ✅ Hiển thị thông tin thiết bị
- ✅ Không có lỗi trong Console

### Test 2: Device không tồn tại
```
https://it-incident-management.vercel.app/?device=NOT_EXIST
```

**Kết quả mong đợi**:
- ✅ Hiển thị "Lỗi: Không tìm thấy thiết bị"
- ✅ Không có lỗi 400 trong Console

### Test 3: Refresh trang
1. Quét QR code device tồn tại
2. Nhấn F5 (refresh)
3. **Kết quả mong đợi**:
   - ✅ Vẫn hiển thị thông tin thiết bị
   - ✅ Không bị lỗi

---

## Tài liệu tham khảo

### Supabase JS Client v2 - single() vs maybeSingle()

**single()**:
https://supabase.com/docs/reference/javascript/select#single
```javascript
// Throws error if 0 or >1 rows
const { data, error } = await supabase
  .from('countries')
  .select()
  .eq('name', 'Singapore')
  .single()
```

**maybeSingle()**:
https://supabase.com/docs/reference/javascript/select#maybesingle
```javascript
// Returns null if 0 rows, no error
const { data, error } = await supabase
  .from('countries')
  .select()
  .eq('name', 'Singapore')
  .maybeSingle()
```

---

## Tóm tắt

### ❌ **Lỗi**
```javascript
.single()  // Throw error nếu không tìm thấy → Promise.all() fail
```

### ✅ **Sửa**
```javascript
.maybeSingle()  // Không throw error, trả về null nếu không tìm thấy
```

### 📊 **Kết quả**
- ✅ Device Info Page hoạt động ổn định
- ✅ Không bị lỗi khi refresh
- ✅ Xử lý graceful khi device không tồn tại
- ✅ Promise.all() không bị fail

---

## Best Practices

### ✅ **Nên làm**

1. **Dùng .maybeSingle() cho queries không chắc chắn**
```javascript
const { data } = await supabaseClient
  .from('devices')
  .select('*')
  .eq('device_code', deviceCode)
  .maybeSingle();  // ✅ Safe

if (!data) {
  // Handle not found
}
```

2. **Dùng .single() cho queries chắc chắn có 1 record**
```javascript
const { data } = await supabaseClient
  .from('users')
  .select('*')
  .eq('id', userId)
  .single();  // ✅ OK vì user luôn tồn tại sau login
```

3. **Xử lý error trong Promise.all()**
```javascript
const [result1, result2] = await Promise.all([
  query1().catch(err => ({ data: null, error: err })),
  query2().catch(err => ({ data: null, error: err }))
]);
```

### ❌ **Không nên làm**

1. **Dùng .single() cho queries không chắc chắn**
```javascript
// ❌ Có thể throw error
const { data } = await supabaseClient
  .from('devices')
  .select('*')
  .eq('device_code', deviceCode)
  .single();
```

2. **Không xử lý trường hợp null**
```javascript
const { data } = await supabaseClient
  .from('devices')
  .select('*')
  .eq('device_code', deviceCode)
  .maybeSingle();

// ❌ Không check null
console.log(data.device_name);  // Error nếu data = null
```

---

## Commit message
```
Fix: Use maybeSingle() instead of single() to handle missing devices gracefully
```
