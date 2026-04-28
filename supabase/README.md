# Supabase Migration - IT Incident Management

Hướng dẫn setup và deploy hệ thống IT Incident Management lên Supabase.

## 📋 Yêu cầu

- Node.js >= 18
- Supabase CLI (`npm install -g supabase`)
- Tài khoản Supabase (https://supabase.com)
- SendGrid hoặc Resend API key (cho email service)

## 🚀 Bước 1: Tạo Supabase Project

1. Truy cập https://supabase.com/dashboard
2. Click **"New Project"**
3. Điền thông tin:
   - **Project name**: `it-incident-management`
   - **Database Password**: (tạo password mạnh)
   - **Region**: Southeast Asia (Singapore)
4. Click **"Create new project"** và đợi ~2 phút
5. Sau khi project được tạo, lưu lại:
   - **Project URL**: `https://vjudueltlidywypsktwk.supabase.co`
   - **Anon key**: (trong Settings → API)
   - **Service role key**: (trong Settings → API)

## 🗄️ Bước 2: Setup Database Schema

### Option 1: Sử dụng Supabase Dashboard (Khuyến nghị)

1. Mở Supabase Dashboard → SQL Editor
2. Copy toàn bộ nội dung file `migrations/001_initial_schema.sql`
3. Paste vào SQL Editor và click **"Run"**
4. Verify: Vào **Database → Tables** để xem 4 tables đã được tạo:
   - `users`
   - `devices`
   - `incidents`
   - `email_queue`

### Option 2: Sử dụng Supabase CLI

```bash
# Login to Supabase
supabase login

# Link to project
supabase link --project-ref vjudueltlidywypsktwk

# Run migrations
supabase db push
```

## 🔐 Bước 3: Configure Environment Variables

1. Copy file `.env.example` thành `.env`:
   ```bash
   cp .env.example .env
   ```

2. Cập nhật các giá trị trong `.env`:
   ```bash
   SUPABASE_URL=https://vjudueltlidywypsktwk.supabase.co
   SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   
   # Email service (chọn 1 trong 3)
   SENDGRID_API_KEY=<your-sendgrid-key>
   # hoặc
   RESEND_API_KEY=<your-resend-key>
   # hoặc
   SMTP_HOST=smtp.gmail.com
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

## 📧 Bước 4: Setup Email Service

### Option 1: SendGrid (Khuyến nghị)

1. Tạo tài khoản tại https://sendgrid.com
2. Tạo API Key: Settings → API Keys → Create API Key
3. Copy API key vào `.env`: `SENDGRID_API_KEY=...`

### Option 2: Resend

1. Tạo tài khoản tại https://resend.com
2. Tạo API Key trong Dashboard
3. Copy API key vào `.env`: `RESEND_API_KEY=...`

### Option 3: SMTP (Gmail)

1. Enable 2-Factor Authentication trong Google Account
2. Tạo App Password: https://myaccount.google.com/apppasswords
3. Copy app password vào `.env`: `SMTP_PASS=...`

## 🔄 Bước 5: Migrate Data từ Google Sheets

### 5.1 Export Data

```bash
cd migration
npm install
node export-google-sheets.js
```

### 5.2 Transform Data

```bash
node transform-data.js
```

### 5.3 Import to Supabase

```bash
node import-to-supabase.js
```

### 5.4 Verify Data

```bash
node verify-data.js
```

## 🌐 Bước 6: Update Frontend

1. Mở file `index.html`
2. Thêm Supabase JS library:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   ```

3. Initialize Supabase client:
   ```javascript
   const supabaseUrl = 'https://vjudueltlidywypsktwk.supabase.co';
   const supabaseAnonKey = 'your-anon-key';
   const supabase = supabase.createClient(supabaseUrl, supabaseAnonKey);
   ```

4. Replace tất cả `google.script.run` calls bằng Supabase API calls

## 📨 Bước 7: Deploy Email Edge Function

```bash
# Deploy Edge Function
supabase functions deploy process-email-queue

# Set environment variables
supabase secrets set SENDGRID_API_KEY=your-key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
```

## ⏰ Bước 8: Setup Email Queue Scheduler

### Option 1: pg_cron (Khuyến nghị)

Chạy SQL trong Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'process-email-queue',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://vjudueltlidywypsktwk.supabase.co/functions/v1/process-email-queue',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);
```

### Option 2: GitHub Actions

Tạo file `.github/workflows/email-processor.yml`:

```yaml
name: Process Email Queue
on:
  schedule:
    - cron: '* * * * *'
jobs:
  process-emails:
    runs-on: ubuntu-latest
    steps:
      - name: Call Edge Function
        run: |
          curl -X POST \
            https://vjudueltlidywypsktwk.supabase.co/functions/v1/process-email-queue \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}"
```

## ✅ Bước 9: Testing

### Test Authentication

```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'test@example.com',
  password: 'password123'
});
console.log(data ? '✅ Login OK' : '❌ Login failed');
```

### Test Device List

```javascript
const { data, error } = await supabase.from('devices').select('*');
console.log(data ? `✅ Found ${data.length} devices` : '❌ Failed');
```

### Test Incident Submission

```javascript
const { data: code } = await supabase.rpc('generate_incident_code');
const { data, error } = await supabase.from('incidents').insert({
  incident_code: code,
  user_name: 'Test User',
  department: 'IT',
  device_code: 'TEST001',
  device_name: 'Test Device',
  description: 'Test incident',
  severity: 'Cao',
  status: 'Open'
});
console.log(data ? '✅ Incident created' : '❌ Failed');
```

## 🔍 Monitoring

### Database Performance

```sql
-- Check recent incidents
SELECT COUNT(*) FROM incidents WHERE created_at > NOW() - INTERVAL '1 hour';

-- Check email queue status
SELECT status, COUNT(*) FROM email_queue GROUP BY status;

-- Check failed emails
SELECT * FROM email_queue WHERE status IN ('FAILED', 'DEAD') ORDER BY created_at DESC LIMIT 10;
```

### Edge Function Logs

```bash
supabase functions logs process-email-queue
```

## 🔄 Rollback Plan

Nếu có vấn đề, rollback về Google Apps Script:

1. Revert frontend code về version cũ
2. Disable Supabase backend
3. Restore Google Sheets từ backup

```bash
git checkout previous-version
clasp push
```

## 📚 Tài liệu tham khảo

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Edge Functions](https://supabase.com/docs/guides/functions)

## 🆘 Support

Nếu gặp vấn đề, liên hệ:
- Email: duomle@krugervn.com
- Check logs trong Supabase Dashboard → Logs
- Check Edge Function logs: `supabase functions logs`

## 📝 Checklist

- [ ] Supabase project created
- [ ] Database schema deployed
- [ ] RLS policies enabled
- [ ] Environment variables configured
- [ ] Data migrated from Google Sheets
- [ ] Frontend updated with Supabase client
- [ ] Edge Function deployed
- [ ] Email scheduler configured
- [ ] Testing completed
- [ ] Production deployed
- [ ] Monitoring setup
