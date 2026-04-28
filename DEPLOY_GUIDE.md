# Hướng dẫn Deploy IT Incident Management lên Internet

## Phương án 1: Deploy lên GitHub Pages (MIỄN PHÍ)

### Bước 1: Tạo GitHub Repository

1. Truy cập https://github.com và đăng nhập
2. Bấm nút "New repository"
3. Đặt tên repository: `it-incident-management`
4. Chọn "Public"
5. Bấm "Create repository"

### Bước 2: Upload code lên GitHub

```bash
# Mở terminal/command prompt tại thư mục dự án
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/it-incident-management.git
git push -u origin main
```

### Bước 3: Bật GitHub Pages

1. Vào repository trên GitHub
2. Bấm "Settings" → "Pages"
3. Trong "Source", chọn "main" branch
4. Bấm "Save"
5. Đợi 1-2 phút, trang web sẽ có địa chỉ: `https://YOUR_USERNAME.github.io/it-incident-management/`

### Bước 4: Đổi tên file chính

Đổi tên `index-supabase-v2.html` thành `index.html` để GitHub Pages tự động nhận diện.

```bash
# Trong thư mục dự án
mv index-supabase-v2.html index.html
git add .
git commit -m "Rename to index.html"
git push
```

---

## Phương án 2: Deploy lên Netlify (MIỄN PHÍ, DỄ HƠN)

### Bước 1: Tạo tài khoản Netlify

1. Truy cập https://www.netlify.com/
2. Bấm "Sign up" → Đăng ký bằng GitHub hoặc Email

### Bước 2: Deploy

**Cách 1: Drag & Drop (Đơn giản nhất)**

1. Đổi tên `index-supabase-v2.html` thành `index.html`
2. Vào https://app.netlify.com/drop
3. Kéo thả toàn bộ thư mục dự án vào
4. Đợi 1-2 phút → Có link website ngay!

**Cách 2: Từ GitHub**

1. Bấm "Add new site" → "Import an existing project"
2. Chọn "GitHub" → Chọn repository
3. Bấm "Deploy site"
4. Đợi 1-2 phút → Có link website!

### Bước 3: Đổi tên miền (Tùy chọn)

1. Vào "Site settings" → "Domain management"
2. Bấm "Add custom domain"
3. Nhập tên miền của bạn (ví dụ: `it-incident.netlify.app`)

---

## Phương án 3: Deploy lên Vercel (MIỄN PHÍ)

### Bước 1: Tạo tài khoản Vercel

1. Truy cập https://vercel.com/
2. Bấm "Sign up" → Đăng ký bằng GitHub

### Bước 2: Deploy

1. Bấm "Add New" → "Project"
2. Chọn repository từ GitHub
3. Bấm "Deploy"
4. Đợi 1-2 phút → Có link website!

---

## Cách tạo mã QR cho thiết bị

Sau khi deploy, bạn sẽ có link website (ví dụ: `https://yoursite.netlify.app`)

### Tạo mã QR cho từng thiết bị:

**Định dạng link:**
```
https://yoursite.netlify.app/?device=MA_THIET_BI
```

**Ví dụ:**
- Thiết bị PC001: `https://yoursite.netlify.app/?device=PC001`
- Thiết bị PRINTER-02: `https://yoursite.netlify.app/?device=PRINTER-02`

### Công cụ tạo mã QR miễn phí:

1. **QR Code Generator**: https://www.qr-code-generator.com/
2. **QRCode Monkey**: https://www.qrcode-monkey.com/
3. **Google QR Code**: Tìm "qr code generator" trên Google

### Cách tạo:

1. Mở công cụ tạo QR
2. Chọn "URL" hoặc "Website"
3. Dán link: `https://yoursite.netlify.app/?device=PC001`
4. Tải xuống mã QR
5. In và dán lên thiết bị

---

## Cách hoạt động:

1. **User quét mã QR** trên thiết bị
2. **Mở link** `https://yoursite.netlify.app/?device=PC001`
3. **Tự động đăng nhập** (nếu đã đăng nhập trước đó)
4. **Tự động chuyển đến tab "Báo hỏng"**
5. **Tự động điền mã thiết bị** PC001
6. **User chỉ cần điền mô tả sự cố** và gửi

---

## Khuyến nghị:

✅ **Netlify** - Đơn giản nhất, phù hợp cho người mới
✅ **GitHub Pages** - Miễn phí, ổn định
✅ **Vercel** - Nhanh, hiện đại

Tất cả đều MIỄN PHÍ và hỗ trợ HTTPS (bắt buộc để dùng camera quét mã).

---

## Lưu ý quan trọng:

1. **Đổi tên file**: `index-supabase-v2.html` → `index.html`
2. **HTTPS**: Tất cả các nền tảng trên đều tự động có HTTPS
3. **Supabase**: Không cần thay đổi gì, vẫn dùng URL và Key như cũ
4. **Cập nhật**: Mỗi lần sửa code, chỉ cần push lên GitHub hoặc kéo thả lại vào Netlify

---

## Hỗ trợ:

Nếu gặp vấn đề, liên hệ:
- GitHub Pages: https://docs.github.com/pages
- Netlify: https://docs.netlify.com/
- Vercel: https://vercel.com/docs
