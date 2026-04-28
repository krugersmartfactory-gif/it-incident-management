# Design Document: Supabase Migration

## Overview

This design document outlines the technical architecture and implementation strategy for migrating the IT Incident Management System from Google Apps Script + Google Sheets to Supabase (PostgreSQL + Edge Functions + Auth).

**Current System:**
- Backend: Google Apps Script
- Database: Google Sheets (4 sheets: user, danh sách thiết bị, Incident Log, EMAIL_QUEUE)
- Frontend: HTML/JavaScript SPA served via Google Apps Script Web App
- Authentication: Custom session management with CacheService
- Email: MailApp with queue-based retry system

**Target System:**
- Backend: Supabase Edge Functions + Direct API calls
- Database: Supabase PostgreSQL with Row Level Security (RLS)
- Frontend: HTML/JavaScript SPA with Supabase JavaScript Client
- Authentication: Supabase Auth (JWT-based)
- Email: Supabase Edge Function with SMTP service (SendGrid/Resend)

**Migration Goals:**
1. Zero data loss during migration
2. Maintain 100% feature parity
3. Preserve UI/UX (minimal frontend changes)
4. Improve performance and scalability
5. Enable real-time updates (optional enhancement)
6. Simplify deployment and maintenance

**Key Design Decisions:**
- Use Supabase JavaScript Client for all database operations (no custom REST API needed)
- Implement Row Level Security (RLS) for authorization at database level
- Use Supabase Auth for authentication (JWT tokens)
- Migrate email queue to PostgreSQL table with Edge Function processor
- Keep QR code URL structure compatible (no QR code reprinting needed)
- Support parallel operation during transition period


## Architecture

### System Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Web Browser]
        QR[QR Code Scanner]
    end
    
    subgraph "Supabase Platform"
        Auth[Supabase Auth<br/>JWT Tokens]
        DB[(PostgreSQL Database<br/>+ RLS Policies)]
        EdgeFn[Edge Functions<br/>Email Processor]
        Realtime[Realtime<br/>WebSocket]
    end
    
    subgraph "External Services"
        SMTP[SMTP Service<br/>SendGrid/Resend]
    end
    
    Browser -->|Login/Signup| Auth
    Browser -->|CRUD Operations| DB
    Browser -->|Subscribe| Realtime
    QR -->|Scan Device Code| Browser
    
    Auth -->|Validate JWT| DB
    DB -->|Trigger| EdgeFn
    EdgeFn -->|Send Email| SMTP
    DB -->|Broadcast Changes| Realtime
    
    style Auth fill:#4CAF50
    style DB fill:#2196F3
    style EdgeFn fill:#FF9800
    style Realtime fill:#9C27B0
```

### Component Architecture

```mermaid
graph LR
    subgraph "Frontend (index.html)"
        UI[UI Components]
        SupaClient[Supabase JS Client]
        SessionMgr[Session Manager]
    end
    
    subgraph "Supabase Backend"
        AuthAPI[Auth API]
        DBAPI[Database API]
        RealtimeAPI[Realtime API]
        EdgeAPI[Edge Functions]
    end
    
    UI --> SupaClient
    SupaClient --> SessionMgr
    SessionMgr --> AuthAPI
    SupaClient --> DBAPI
    SupaClient --> RealtimeAPI
    DBAPI --> EdgeAPI
    
    style SupaClient fill:#4CAF50
    style AuthAPI fill:#2196F3
    style DBAPI fill:#FF9800
```

### Data Flow Diagrams

#### Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant SupaAuth
    participant Database
    
    User->>Frontend: Enter email/password
    Frontend->>SupaAuth: signInWithPassword()
    SupaAuth->>Database: Validate credentials
    Database-->>SupaAuth: User record
    SupaAuth-->>Frontend: JWT access + refresh tokens
    Frontend->>Frontend: Store tokens in storage
    Frontend->>Database: Fetch user profile
    Database-->>Frontend: User data (name, dept, permissions)
    Frontend-->>User: Show main app
```

#### Incident Submission Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Database
    participant EdgeFunction
    participant SMTP
    
    User->>Frontend: Submit incident form
    Frontend->>Database: INSERT into incidents table
    Database-->>Frontend: New incident record
    Frontend->>Database: INSERT into email_queue
    Database->>EdgeFunction: Trigger (via cron/webhook)
    EdgeFunction->>Database: SELECT pending emails
    EdgeFunction->>SMTP: Send email
    SMTP-->>EdgeFunction: Success/Failure
    EdgeFunction->>Database: UPDATE email status
    Frontend-->>User: Show success message
```

#### QR Code Scan Flow

```mermaid
sequenceDiagram
    participant QR
    participant Frontend
    participant Database
    
    QR->>Frontend: Scan QR → URL with ?id=TN141
    Frontend->>Frontend: Extract device code from URL
    Frontend->>Database: SELECT device WHERE code = 'TN141'
    Database-->>Frontend: Device info
    Frontend->>Database: COUNT incidents WHERE device_code = 'TN141'
    Database-->>Frontend: Repair count
    Frontend-->>QR: Display device info page
    Note over Frontend: User can login to report incident
```

### Technology Stack

| Layer | Current (Google Apps Script) | Target (Supabase) |
|-------|------------------------------|-------------------|
| **Frontend** | HTML/JS served by GAS | HTML/JS (static hosting or GAS) |
| **Backend Logic** | Google Apps Script | Supabase Edge Functions + Client-side |
| **Database** | Google Sheets | PostgreSQL (Supabase) |
| **Authentication** | Custom (CacheService) | Supabase Auth (JWT) |
| **Authorization** | Application-level | Row Level Security (RLS) |
| **Email** | MailApp | Edge Function + SMTP |
| **Real-time** | Polling | Supabase Realtime (WebSocket) |
| **File Storage** | N/A | Supabase Storage (future) |


## Components and Interfaces

### 1. Database Schema (PostgreSQL)

#### 1.1 Users Table

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  phone TEXT,
  access_role TEXT NOT NULL DEFAULT 'user' CHECK (access_role IN ('user', 'manager')),
  form_access TEXT NOT NULL DEFAULT 'báo hỏng, xử lý, đánh giá',
  password_last_changed TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX idx_users_email ON users(email);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read only their own record
CREATE POLICY "Users can read own record"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own record (for password changes)
CREATE POLICY "Users can update own record"
  ON users FOR UPDATE
  USING (auth.uid() = id);
```

**Migration Notes:**
- `id` will be generated as UUID (not migrated from Google Sheets)
- `email` maps to Column A in "user" sheet
- `password_hash` is managed by Supabase Auth (not in this table)
- `name` maps to Column C
- `department` maps to Column D
- `phone` maps to Column E
- `access_role` maps to Column F
- `form_access` maps to Column H
- `password_last_changed` maps to Column G

#### 1.2 Devices Table

```sql
-- Devices table
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  purchase_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'retired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for device code lookups (case-insensitive)
CREATE INDEX idx_devices_code ON devices(LOWER(code));

-- Index for department filtering
CREATE INDEX idx_devices_department ON devices(department);

-- Trigger to update updated_at
CREATE TRIGGER update_devices_updated_at
  BEFORE UPDATE ON devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read devices
CREATE POLICY "Authenticated users can read devices"
  ON devices FOR SELECT
  TO authenticated
  USING (true);

-- Only managers can insert/update/delete devices
CREATE POLICY "Managers can manage devices"
  ON devices FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.access_role = 'manager'
    )
  );
```

**Migration Notes:**
- `code` maps to Column A in "danh sách thiết bị" sheet
- `name` maps to Column B
- `department` maps to Column C
- `purchase_date` maps to Column D (convert to DATE type)
- `status` is new field (default 'active')

#### 1.3 Incidents Table

```sql
-- Incidents table
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_code TEXT UNIQUE NOT NULL,
  incident_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_name TEXT NOT NULL,
  department TEXT NOT NULL,
  device_code TEXT NOT NULL,
  device_name TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('Cao', 'Trung bình', 'Thấp')),
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Closed')),
  resolver TEXT,
  resolution TEXT,
  root_cause TEXT,
  resolve_date TIMESTAMPTZ,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  rater_name TEXT,
  attitude_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Foreign key to devices (soft reference, no CASCADE)
  CONSTRAINT fk_device_code FOREIGN KEY (device_code) 
    REFERENCES devices(code) ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX idx_incidents_code ON incidents(incident_code);
CREATE INDEX idx_incidents_device_code ON incidents(device_code);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_severity ON incidents(severity);
CREATE INDEX idx_incidents_date ON incidents(incident_date DESC);

-- Composite index for unrated incidents query
CREATE INDEX idx_incidents_unrated ON incidents(device_code, status, rating)
  WHERE status = 'Closed' AND rating IS NULL;

-- Trigger to update updated_at
CREATE TRIGGER update_incidents_updated_at
  BEFORE UPDATE ON incidents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read all incidents
CREATE POLICY "Authenticated users can read incidents"
  ON incidents FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can insert incidents
CREATE POLICY "Authenticated users can create incidents"
  ON incidents FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users with "xử lý" permission can update resolution fields
CREATE POLICY "Users with xử lý permission can resolve incidents"
  ON incidents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.form_access LIKE '%xử lý%'
    )
  )
  WITH CHECK (
    -- Only allow updating resolution-related fields
    (OLD.status = 'Open' AND NEW.status = 'Closed')
    OR (OLD.rating IS NULL AND NEW.rating IS NOT NULL)
  );

-- All authenticated users can update rating fields
CREATE POLICY "Authenticated users can rate incidents"
  ON incidents FOR UPDATE
  TO authenticated
  USING (status = 'Closed' AND rating IS NULL)
  WITH CHECK (rating IS NOT NULL);
```

**Migration Notes:**
- `incident_code` maps to Column A in "Incident Log" sheet
- `incident_date` maps to Column B (convert to TIMESTAMPTZ)
- `user_name` maps to Column C
- `department` maps to Column D
- `device_code` maps to Column E
- `device_name` maps to Column F
- `description` maps to Column G
- `severity` maps to Column H
- `status` maps to Column I
- `resolver` maps to Column J
- `resolution` maps to Column K
- `root_cause` maps to Column L
- `resolve_date` maps to Column M (convert to TIMESTAMPTZ)
- `rating` maps to Column N
- `rater_name` maps to Column O
- `attitude_comment` maps to Column P

#### 1.4 Email Queue Table

```sql
-- Email queue table
CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'PENDING' 
    CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'DEAD')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_attempt TIMESTAMPTZ,
  subject TEXT NOT NULL,
  to_email TEXT NOT NULL,
  cc_emails TEXT,
  html_body TEXT NOT NULL,
  error_log TEXT,
  
  -- Index for processing queue
  CONSTRAINT chk_retry_count CHECK (retry_count >= 0 AND retry_count <= 3)
);

-- Index for queue processing
CREATE INDEX idx_email_queue_status ON email_queue(status, retry_count)
  WHERE status IN ('PENDING', 'FAILED');

-- Index for created_at ordering
CREATE INDEX idx_email_queue_created ON email_queue(created_at DESC);

-- RLS Policies
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Only service role can access email queue (no user access)
CREATE POLICY "Service role only"
  ON email_queue FOR ALL
  TO service_role
  USING (true);
```

**Migration Notes:**
- `created_at` maps to Column A in "EMAIL_QUEUE" sheet
- `status` maps to Column B
- `retry_count` maps to Column C
- `last_attempt` maps to Column D
- `subject` maps to Column E
- `to_email` maps to Column F
- `cc_emails` maps to Column G
- `html_body` maps to Column H
- `error_log` maps to Column I

#### 1.5 Database Functions

```sql
-- Function to generate incident code
CREATE OR REPLACE FUNCTION generate_incident_code()
RETURNS TEXT AS $$
DECLARE
  current_year INTEGER;
  max_seq INTEGER;
  next_seq INTEGER;
  seq_str TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW());
  
  -- Get max sequence for current year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(incident_code FROM 'INC-' || current_year || '-(.*)') AS INTEGER)
  ), 0) INTO max_seq
  FROM incidents
  WHERE incident_code LIKE 'INC-' || current_year || '-%';
  
  next_seq := max_seq + 1;
  
  -- Format sequence with leading zeros
  seq_str := LPAD(next_seq::TEXT, 3, '0');
  
  RETURN 'INC-' || current_year || '-' || seq_str;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate device age in months
CREATE OR REPLACE FUNCTION calculate_device_age_months(purchase_date DATE)
RETURNS INTEGER AS $$
BEGIN
  IF purchase_date IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN (
    (EXTRACT(YEAR FROM AGE(CURRENT_DATE, purchase_date)) * 12) +
    EXTRACT(MONTH FROM AGE(CURRENT_DATE, purchase_date))
  )::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to count device repairs
CREATE OR REPLACE FUNCTION count_device_repairs(device_code_param TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM incidents
    WHERE LOWER(device_code) = LOWER(device_code_param)
    AND status = 'Closed'
  );
END;
$$ LANGUAGE plpgsql STABLE;
```

### 2. Supabase Authentication Integration

#### 2.1 Authentication Flow

**Supabase Auth Configuration:**
- Enable Email/Password authentication
- JWT expiration: 1 hour (access token)
- Refresh token expiration: 30 days
- Password requirements: minimum 6 characters

**User Registration Process:**
During migration, users will be created in Supabase Auth with the following approach:

```javascript
// Migration script: Create Supabase Auth users
async function migrateUsers(googleSheetsUsers) {
  for (const user of googleSheetsUsers) {
    // Create auth user with temporary password
    const { data: authUser, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: 'TempPassword123!', // Users must reset on first login
      email_confirm: true,
      user_metadata: {
        name: user.name,
        department: user.department,
        phone: user.phone,
        access_role: user.access_role,
        form_access: user.form_access
      }
    });
    
    if (error) {
      console.error(`Failed to create user ${user.email}:`, error);
      continue;
    }
    
    // Insert user profile into users table
    await supabase.from('users').insert({
      id: authUser.user.id, // Use Supabase Auth UUID
      email: user.email,
      name: user.name,
      department: user.department,
      phone: user.phone,
      access_role: user.access_role,
      form_access: user.form_access,
      password_last_changed: null // Force password change
    });
  }
}
```

#### 2.2 Frontend Authentication Code

```javascript
// Initialize Supabase client
const supabaseUrl = 'https://vjudueltlidywypsktwk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
const supabase = supabase.createClient(supabaseUrl, supabaseAnonKey);

// Login function
async function handleLogin(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });
    
    if (error) throw error;
    
    // Store session
    sessionStorage.setItem('supabase.auth.token', JSON.stringify(data.session));
    
    // Fetch user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();
    
    if (profileError) throw profileError;
    
    // Store user info
    sessionStorage.setItem('userName', userProfile.name);
    sessionStorage.setItem('department', userProfile.department);
    sessionStorage.setItem('formAccess', userProfile.form_access);
    sessionStorage.setItem('accessRole', userProfile.access_role);
    
    return { success: true, user: userProfile };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Logout function
async function handleLogout() {
  await supabase.auth.signOut();
  sessionStorage.clear();
  window.location.reload();
}

// Check session on page load
async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    showLoginPage();
    return;
  }
  
  // Fetch user profile
  const { data: userProfile } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single();
  
  if (userProfile) {
    showMainApp(userProfile);
  }
}

// Password change function
async function handleChangePassword(oldPassword, newPassword) {
  try {
    // Verify old password by re-authenticating
    const { data: { user } } = await supabase.auth.getUser();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: oldPassword
    });
    
    if (signInError) {
      return { success: false, error: 'Mật khẩu cũ không đúng' };
    }
    
    // Update password
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    
    if (error) throw error;
    
    // Update password_last_changed in users table
    await supabase
      .from('users')
      .update({ password_last_changed: new Date().toISOString() })
      .eq('id', user.id);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### 3. Frontend API Integration

#### 3.1 Device Operations

```javascript
// Get all devices
async function getDeviceList() {
  try {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .order('code', { ascending: true });
    
    if (error) throw error;
    
    return { success: true, devices: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get device by code (case-insensitive)
async function getDeviceInfo(deviceCode) {
  try {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .ilike('code', deviceCode)
      .single();
    
    if (error) throw error;
    
    // Calculate age
    const ageMonths = calculateDeviceAgeMonths(data.purchase_date);
    
    // Get repair count
    const { count } = await supabase
      .from('incidents')
      .select('*', { count: 'exact', head: true })
      .ilike('device_code', deviceCode)
      .eq('status', 'Closed');
    
    return {
      success: true,
      device: {
        ...data,
        age: `${ageMonths} tuổi`,
        repairCount: count || 0
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Calculate device age in months (client-side)
function calculateDeviceAgeMonths(purchaseDateStr) {
  if (!purchaseDateStr) return 0;
  
  const purchaseDate = new Date(purchaseDateStr);
  const today = new Date();
  
  const months = (today.getFullYear() - purchaseDate.getFullYear()) * 12 +
                 (today.getMonth() - purchaseDate.getMonth());
  
  return Math.max(0, months);
}
```

#### 3.2 Incident Operations

```javascript
// Submit new incident
async function submitIncident(incidentData) {
  try {
    // Generate incident code (call database function)
    const { data: codeData, error: codeError } = await supabase
      .rpc('generate_incident_code');
    
    if (codeError) throw codeError;
    
    const incidentCode = codeData;
    
    // Insert incident
    const { data, error } = await supabase
      .from('incidents')
      .insert({
        incident_code: incidentCode,
        user_name: incidentData.userName,
        department: incidentData.department,
        device_code: incidentData.deviceCode,
        device_name: incidentData.deviceName,
        description: incidentData.description,
        severity: incidentData.severity,
        status: 'Open'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Enqueue email notification
    await enqueueIncidentEmail(incidentCode, incidentData);
    
    return { success: true, incidentCode: incidentCode };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get open incidents
async function getOpenIncidents() {
  try {
    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .eq('status', 'Open')
      .order('incident_date', { ascending: false });
    
    if (error) throw error;
    
    return { success: true, incidents: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Resolve incident
async function resolveIncident(incidentCode, resolutionData) {
  try {
    const { data, error } = await supabase
      .from('incidents')
      .update({
        status: 'Closed',
        resolver: resolutionData.resolver,
        resolution: resolutionData.resolution,
        root_cause: resolutionData.rootCause,
        resolve_date: new Date().toISOString()
      })
      .eq('incident_code', incidentCode)
      .eq('status', 'Open') // Prevent double-closing
      .select()
      .single();
    
    if (error) throw error;
    
    // Enqueue resolution email
    await enqueueResolutionEmail(incidentCode, data);
    
    return { success: true, incidentCode: incidentCode };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get unrated incidents for device
async function getUnratedIncidentsByDevice(deviceCode) {
  try {
    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .ilike('device_code', deviceCode)
      .eq('status', 'Closed')
      .is('rating', null)
      .order('resolve_date', { ascending: false });
    
    if (error) throw error;
    
    return { success: true, incidents: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Rate incident
async function rateIncident(incidentCode, rating, raterName, attitudeComment) {
  try {
    const { data, error } = await supabase
      .from('incidents')
      .update({
        rating: rating,
        rater_name: raterName,
        attitude_comment: attitudeComment
      })
      .eq('incident_code', incidentCode)
      .eq('status', 'Closed')
      .is('rating', null) // Prevent double-rating
      .select()
      .single();
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

#### 3.3 Email Queue Operations

```javascript
// Enqueue incident email
async function enqueueIncidentEmail(incidentCode, incidentData) {
  const subject = `[BÁO HỎNG] ${incidentData.deviceCode} - ${incidentData.severity} - ${incidentData.deviceName}`;
  const htmlBody = buildIncidentEmailHtml(incidentCode, incidentData);
  
  const { error } = await supabase
    .from('email_queue')
    .insert({
      status: 'PENDING',
      subject: subject,
      to_email: 'duomle@krugervn.com',
      cc_emails: 'duom1988@gmail.com',
      html_body: htmlBody
    });
  
  if (error) {
    console.error('Failed to enqueue email:', error);
  }
}

// Build HTML email body (same as current system)
function buildIncidentEmailHtml(incidentCode, incidentData) {
  const severityColorMap = {
    'Cao': '#d32f2f',
    'Trung bình': '#F57C00',
    'Thấp': '#388E3C'
  };
  const pColor = severityColorMap[incidentData.severity] || '#555';
  
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;}
      .content{padding:20px;background:#f9f9f9;}
      .info-box{background:white;border-left:4px solid #2196F3;padding:15px;margin:10px 0;}
      .label{font-weight:bold;color:#555;}
      .value{color:#000;margin-left:8px;}
    </style></head><body>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1565C0;">
      <tr><td align="center" style="padding:24px 20px;background:linear-gradient(135deg,#2196F3 0%,#1565C0 100%);">
        <h2 style="margin:0;color:#ffffff;font-size:22px;">🔧 BÁO HỎNG THIẾT BỊ 🔧</h2>
        <p style="margin:8px 0 0 0;color:#ffffff;font-size:13px;">Hệ thống quản lý sự cố IT</p>
      </td></tr>
    </table>
    <div class="content">
      <div class="info-box">
        <h3 style="color:#1565C0;margin-top:0;border-bottom:2px solid #2196F3;padding-bottom:6px;">
          📋 THÔNG TIN NGƯỜI BÁO CÁO
        </h3>
        <p><span class="label">👤 Họ tên:</span><span class="value">${incidentData.userName}</span></p>
        <p><span class="label">🏢 Bộ phận:</span><span class="value">${incidentData.department}</span></p>
      </div>
      <div class="info-box">
        <h3 style="color:#1565C0;margin-top:0;border-bottom:2px solid #2196F3;padding-bottom:6px;">
          🖥️ THÔNG TIN THIẾT BỊ
        </h3>
        <p><span class="label">Tên thiết bị:</span><span class="value">${incidentData.deviceName}</span></p>
        <p><span class="label">Mã thiết bị:</span><span class="value">${incidentData.deviceCode}</span></p>
      </div>
      <div class="info-box">
        <h3 style="color:#BF360C;margin-top:0;border-bottom:2px solid #E64A19;padding-bottom:6px;">
          ⚠️ CHI TIẾT SỰ CỐ
        </h3>
        <p><span class="label">Mã sự cố:</span><span class="value" style="color:#1565C0;font-weight:bold;">${incidentCode}</span></p>
        <p><span class="label">Mức độ ưu tiên:</span><span class="value" style="color:${pColor};font-weight:bold;">${incidentData.severity}</span></p>
        <p><span class="label">📄 Mô tả:</span></p>
        <p style="background:#f5f5f5;padding:10px;border-radius:4px;margin:5px 0;">${incidentData.description}</p>
      </div>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center" style="padding:15px;font-size:12px;color:#999;border-top:1px solid #eee;">
        <p style="margin:4px 0;">CÔNG TY TNHH CÔNG NGHIỆP THÔNG GIÓ KRUGER VIỆT NAM</p>
        <p style="margin:4px 0;">Email tự động – Vui lòng không trả lời email này</p>
        <p style="margin:4px 0;">⏰ ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
      </td></tr>
    </table>
  </body></html>`;
}
```


## Data Models

### Entity Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ INCIDENTS : "reports"
    DEVICES ||--o{ INCIDENTS : "has"
    INCIDENTS ||--o{ EMAIL_QUEUE : "triggers"
    
    USERS {
        uuid id PK
        text email UK
        text name
        text department
        text phone
        text access_role
        text form_access
        timestamptz password_last_changed
        timestamptz created_at
        timestamptz updated_at
    }
    
    DEVICES {
        uuid id PK
        text code UK
        text name
        text department
        date purchase_date
        text status
        timestamptz created_at
        timestamptz updated_at
    }
    
    INCIDENTS {
        uuid id PK
        text incident_code UK
        timestamptz incident_date
        text user_name
        text department
        text device_code FK
        text device_name
        text description
        text severity
        text status
        text resolver
        text resolution
        text root_cause
        timestamptz resolve_date
        integer rating
        text rater_name
        text attitude_comment
        timestamptz created_at
        timestamptz updated_at
    }
    
    EMAIL_QUEUE {
        uuid id PK
        timestamptz created_at
        text status
        integer retry_count
        timestamptz last_attempt
        text subject
        text to_email
        text cc_emails
        text html_body
        text error_log
    }
```

### Data Type Mappings

| Google Sheets Type | PostgreSQL Type | Notes |
|-------------------|-----------------|-------|
| Text | TEXT | No length limit |
| Number | INTEGER | For counts, ratings |
| Date | DATE | For purchase_date |
| DateTime | TIMESTAMPTZ | With timezone support |
| Email | TEXT | With validation in app |
| UUID | UUID | Generated by PostgreSQL |

### Data Validation Rules

**Users Table:**
- `email`: Must be valid email format (enforced by Supabase Auth)
- `access_role`: Must be 'user' or 'manager'
- `form_access`: Comma-separated list of permissions

**Devices Table:**
- `code`: Unique, case-insensitive
- `status`: Must be 'active', 'inactive', or 'retired'
- `purchase_date`: Cannot be in the future

**Incidents Table:**
- `severity`: Must be 'Cao', 'Trung bình', or 'Thấp'
- `status`: Must be 'Open' or 'Closed'
- `rating`: Integer between 1 and 5 (if not null)
- `resolve_date`: Required when status = 'Closed'

**Email Queue Table:**
- `status`: Must be 'PENDING', 'SENT', 'FAILED', or 'DEAD'
- `retry_count`: Between 0 and 3
- `to_email`: Required, valid email format


## Email Service Design

### Supabase Edge Function: Email Processor

**File: `supabase/functions/process-email-queue/index.ts`**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SMTP_HOST = Deno.env.get('SMTP_HOST') || 'smtp.sendgrid.net';
const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '587');
const SMTP_USER = Deno.env.get('SMTP_USER')!;
const SMTP_PASS = Deno.env.get('SMTP_PASS')!;
const MAX_RETRY = 3;

interface EmailRecord {
  id: string;
  status: string;
  retry_count: number;
  subject: string;
  to_email: string;
  cc_emails: string | null;
  html_body: string;
}

serve(async (req) => {
  try {
    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch pending and failed emails (with retry limit)
    const { data: emails, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .or(`status.eq.PENDING,and(status.eq.FAILED,retry_count.lt.${MAX_RETRY})`)
      .order('created_at', { ascending: true })
      .limit(10); // Process 10 emails per invocation

    if (fetchError) {
      console.error('Error fetching emails:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!emails || emails.length === 0) {
      return new Response(JSON.stringify({ message: 'No emails to process' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const results = [];

    for (const email of emails as EmailRecord[]) {
      try {
        // Send email via SMTP
        await sendEmail(email);

        // Update status to SENT
        await supabase
          .from('email_queue')
          .update({
            status: 'SENT',
            last_attempt: new Date().toISOString(),
            error_log: null
          })
          .eq('id', email.id);

        results.push({ id: email.id, status: 'SENT' });
        console.log(`✅ Email sent: ${email.id}`);
      } catch (error) {
        const newRetryCount = email.retry_count + 1;
        const newStatus = newRetryCount >= MAX_RETRY ? 'DEAD' : 'FAILED';
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Update status to FAILED or DEAD
        await supabase
          .from('email_queue')
          .update({
            status: newStatus,
            retry_count: newRetryCount,
            last_attempt: new Date().toISOString(),
            error_log: `[${new Date().toISOString()}] ${errorMessage}`
          })
          .eq('id', email.id);

        results.push({ id: email.id, status: newStatus, error: errorMessage });
        console.error(`❌ Email failed: ${email.id}, retry: ${newRetryCount}, error: ${errorMessage}`);
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

async function sendEmail(email: EmailRecord): Promise<void> {
  // Using Deno's built-in SMTP client or external library
  // For production, use SendGrid API or Resend API instead of raw SMTP
  
  // Example using SendGrid API
  const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')!;
  
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: email.to_email }],
          cc: email.cc_emails ? email.cc_emails.split(',').map(e => ({ email: e.trim() })) : [],
          subject: email.subject
        }
      ],
      from: {
        email: 'noreply@krugervn.com',
        name: 'Hệ thống Báo hỏng - Kruger VN'
      },
      content: [
        {
          type: 'text/html',
          value: email.html_body
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
  }
}
```

### Alternative: Using Resend API

**File: `supabase/functions/process-email-queue/index.ts` (Resend version)**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;

async function sendEmailViaResend(email: EmailRecord): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Hệ thống Báo hỏng <noreply@krugervn.com>',
      to: [email.to_email],
      cc: email.cc_emails ? email.cc_emails.split(',').map(e => e.trim()) : [],
      subject: email.subject,
      html: email.html_body
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
  }
}
```

### Scheduled Trigger Setup

**Option 1: Supabase Cron Job (pg_cron)**

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule email processor to run every 1 minute
SELECT cron.schedule(
  'process-email-queue',
  '* * * * *', -- Every minute
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

**Option 2: External Cron Service (cron-job.org, GitHub Actions)**

```yaml
# .github/workflows/email-processor.yml
name: Process Email Queue

on:
  schedule:
    - cron: '* * * * *' # Every minute
  workflow_dispatch: # Manual trigger

jobs:
  process-emails:
    runs-on: ubuntu-latest
    steps:
      - name: Call Supabase Edge Function
        run: |
          curl -X POST \
            https://vjudueltlidywypsktwk.supabase.co/functions/v1/process-email-queue \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json"
```

**Option 3: Webhook Trigger (from frontend)**

```javascript
// Trigger email processing after incident submission
async function submitIncident(incidentData) {
  // ... insert incident ...
  
  // Enqueue email
  await enqueueIncidentEmail(incidentCode, incidentData);
  
  // Trigger email processor immediately (optional)
  try {
    await fetch('https://vjudueltlidywypsktwk.supabase.co/functions/v1/process-email-queue', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.warn('Failed to trigger email processor:', error);
    // Non-critical - cron will pick it up
  }
}
```

### Email Service Configuration

**Environment Variables (Supabase Dashboard → Settings → Edge Functions)**

```bash
SUPABASE_URL=https://vjudueltlidywypsktwk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Option 1: SendGrid
SENDGRID_API_KEY=<your-sendgrid-api-key>

# Option 2: Resend
RESEND_API_KEY=<your-resend-api-key>

# Option 3: SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Email Templates

Email templates remain the same as current system (HTML format with inline CSS). The `buildIncidentEmailHtml()` function can be reused without changes.


## Error Handling

### Frontend Error Handling Strategy

```javascript
// Centralized error handler
function handleSupabaseError(error, context) {
  console.error(`Error in ${context}:`, error);
  
  // Map Supabase errors to user-friendly messages
  const errorMessages = {
    'Invalid login credentials': 'Email hoặc mật khẩu không đúng',
    'Email not confirmed': 'Email chưa được xác nhận',
    'User already registered': 'Email đã được đăng ký',
    'JWT expired': 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    'Permission denied': 'Bạn không có quyền thực hiện thao tác này',
    'Row not found': 'Không tìm thấy dữ liệu',
    'Unique constraint violation': 'Dữ liệu đã tồn tại',
    'Foreign key violation': 'Không thể xóa do có dữ liệu liên quan'
  };
  
  // Check for specific error codes
  if (error.code === 'PGRST116') {
    return 'Không tìm thấy dữ liệu';
  }
  
  if (error.code === '23505') {
    return 'Dữ liệu đã tồn tại (trùng lặp)';
  }
  
  if (error.code === '23503') {
    return 'Không thể xóa do có dữ liệu liên quan';
  }
  
  // Check for known error messages
  for (const [key, value] of Object.entries(errorMessages)) {
    if (error.message && error.message.includes(key)) {
      return value;
    }
  }
  
  // Default error message
  return error.message || 'Đã xảy ra lỗi. Vui lòng thử lại.';
}

// Example usage
async function submitIncident(incidentData) {
  try {
    // ... Supabase operations ...
    return { success: true, incidentCode: incidentCode };
  } catch (error) {
    const userMessage = handleSupabaseError(error, 'submitIncident');
    return { success: false, error: userMessage };
  }
}
```

### Session Expiration Handling

```javascript
// Auto-refresh token before expiration
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('Token refreshed successfully');
  }
  
  if (event === 'SIGNED_OUT') {
    console.log('User signed out');
    sessionStorage.clear();
    showLoginPage();
  }
  
  if (event === 'USER_UPDATED') {
    console.log('User updated');
  }
});

// Manual token refresh (if needed)
async function refreshSession() {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) {
    console.error('Failed to refresh session:', error);
    handleLogout();
  }
}
```

### Network Error Handling

```javascript
// Retry logic for network errors
async function retryOperation(operation, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Check if error is retryable (network error, timeout, etc.)
      if (error.message.includes('fetch') || error.message.includes('network')) {
        console.warn(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        throw error; // Non-retryable error
      }
    }
  }
}

// Example usage
async function getDeviceList() {
  return retryOperation(async () => {
    const { data, error } = await supabase
      .from('devices')
      .select('*');
    
    if (error) throw error;
    return { success: true, devices: data };
  });
}
```

### Database Constraint Violations

```javascript
// Handle unique constraint violations
async function submitIncident(incidentData) {
  try {
    // Generate incident code
    const { data: codeData, error: codeError } = await supabase
      .rpc('generate_incident_code');
    
    if (codeError) throw codeError;
    
    // Insert incident with retry on unique constraint violation
    let retries = 0;
    while (retries < 3) {
      try {
        const { data, error } = await supabase
          .from('incidents')
          .insert({ incident_code: codeData, ...incidentData })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, incidentCode: codeData };
      } catch (error) {
        if (error.code === '23505' && retries < 2) {
          // Unique constraint violation - regenerate code
          retries++;
          const { data: newCode } = await supabase.rpc('generate_incident_code');
          codeData = newCode;
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    return { success: false, error: handleSupabaseError(error, 'submitIncident') };
  }
}
```

### RLS Policy Violations

```javascript
// Handle permission denied errors
async function resolveIncident(incidentCode, resolutionData) {
  try {
    const { data, error } = await supabase
      .from('incidents')
      .update(resolutionData)
      .eq('incident_code', incidentCode)
      .select()
      .single();
    
    if (error) {
      if (error.code === '42501' || error.message.includes('permission')) {
        return {
          success: false,
          error: 'Bạn không có quyền xử lý sự cố. Vui lòng kiểm tra quyền truy cập.'
        };
      }
      throw error;
    }
    
    return { success: true, incidentCode: incidentCode };
  } catch (error) {
    return { success: false, error: handleSupabaseError(error, 'resolveIncident') };
  }
}
```

### Email Service Error Handling

**Edge Function Error Handling:**

```typescript
// In process-email-queue Edge Function
try {
  await sendEmail(email);
  
  // Success - update status
  await supabase
    .from('email_queue')
    .update({ status: 'SENT', last_attempt: new Date().toISOString() })
    .eq('id', email.id);
    
} catch (error) {
  const newRetryCount = email.retry_count + 1;
  const newStatus = newRetryCount >= MAX_RETRY ? 'DEAD' : 'FAILED';
  
  // Log detailed error for debugging
  const errorLog = {
    timestamp: new Date().toISOString(),
    error: error.message,
    stack: error.stack,
    email_id: email.id,
    retry_count: newRetryCount
  };
  
  console.error('Email send failed:', errorLog);
  
  // Update status with error details
  await supabase
    .from('email_queue')
    .update({
      status: newStatus,
      retry_count: newRetryCount,
      last_attempt: new Date().toISOString(),
      error_log: JSON.stringify(errorLog)
    })
    .eq('id', email.id);
}
```

### Logging and Monitoring

```javascript
// Client-side error logging
function logError(context, error, additionalData = {}) {
  const errorLog = {
    timestamp: new Date().toISOString(),
    context: context,
    error: {
      message: error.message,
      code: error.code,
      stack: error.stack
    },
    user: {
      email: sessionStorage.getItem('email'),
      name: sessionStorage.getItem('userName')
    },
    ...additionalData
  };
  
  console.error('Error log:', errorLog);
  
  // Optional: Send to external logging service (Sentry, LogRocket, etc.)
  // sendToLoggingService(errorLog);
}

// Example usage
async function submitIncident(incidentData) {
  try {
    // ... operations ...
  } catch (error) {
    logError('submitIncident', error, { incidentData });
    return { success: false, error: handleSupabaseError(error, 'submitIncident') };
  }
}
```


## Testing Strategy

### Unit Testing

**Test Framework:** Jest + @supabase/supabase-js

**Test Coverage Areas:**
1. Authentication functions (login, logout, password change)
2. Device operations (getDeviceList, getDeviceInfo)
3. Incident operations (submit, resolve, rate)
4. Email queue operations
5. Error handling functions
6. Data validation functions

**Example Unit Tests:**

```javascript
// tests/auth.test.js
import { createClient } from '@supabase/supabase-js';

describe('Authentication', () => {
  let supabase;
  
  beforeAll(() => {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
  });
  
  test('should login with valid credentials', async () => {
    const result = await handleLogin('test@example.com', 'password123');
    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.user.email).toBe('test@example.com');
  });
  
  test('should reject invalid credentials', async () => {
    const result = await handleLogin('test@example.com', 'wrongpassword');
    expect(result.success).toBe(false);
    expect(result.error).toContain('không đúng');
  });
  
  test('should change password successfully', async () => {
    // Login first
    await handleLogin('test@example.com', 'oldpassword');
    
    // Change password
    const result = await handleChangePassword('oldpassword', 'newpassword');
    expect(result.success).toBe(true);
    
    // Verify new password works
    const loginResult = await handleLogin('test@example.com', 'newpassword');
    expect(loginResult.success).toBe(true);
  });
});

// tests/incidents.test.js
describe('Incident Operations', () => {
  test('should submit incident successfully', async () => {
    const incidentData = {
      userName: 'Test User',
      department: 'IT',
      deviceCode: 'TEST001',
      deviceName: 'Test Device',
      description: 'Test incident',
      severity: 'Cao'
    };
    
    const result = await submitIncident(incidentData);
    expect(result.success).toBe(true);
    expect(result.incidentCode).toMatch(/^INC-\d{4}-\d{3}$/);
  });
  
  test('should reject invalid severity', async () => {
    const incidentData = {
      userName: 'Test User',
      department: 'IT',
      deviceCode: 'TEST001',
      deviceName: 'Test Device',
      description: 'Test incident',
      severity: 'Invalid' // Invalid severity
    };
    
    const result = await submitIncident(incidentData);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
  
  test('should resolve incident successfully', async () => {
    // Submit incident first
    const submitResult = await submitIncident({...});
    const incidentCode = submitResult.incidentCode;
    
    // Resolve incident
    const resolveResult = await resolveIncident(incidentCode, {
      resolver: 'IT Staff',
      resolution: 'Fixed',
      rootCause: 'Hardware failure'
    });
    
    expect(resolveResult.success).toBe(true);
  });
});
```

### Integration Testing

**Test Scenarios:**
1. End-to-end incident submission flow (submit → email → resolve → rate)
2. QR code scan → device info → login → submit incident
3. User authentication → permission check → data access
4. Email queue processing (PENDING → SENT)
5. Concurrent incident submissions (race condition testing)

**Example Integration Test:**

```javascript
// tests/integration/incident-flow.test.js
describe('Incident Flow Integration', () => {
  test('complete incident lifecycle', async () => {
    // 1. Login as user
    const loginResult = await handleLogin('user@example.com', 'password');
    expect(loginResult.success).toBe(true);
    
    // 2. Submit incident
    const submitResult = await submitIncident({
      userName: 'Test User',
      department: 'IT',
      deviceCode: 'TEST001',
      deviceName: 'Test Device',
      description: 'Test incident',
      severity: 'Cao'
    });
    expect(submitResult.success).toBe(true);
    const incidentCode = submitResult.incidentCode;
    
    // 3. Verify email was enqueued
    const { data: emailQueue } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'PENDING')
      .ilike('subject', `%${incidentCode}%`);
    expect(emailQueue.length).toBeGreaterThan(0);
    
    // 4. Login as IT staff
    await handleLogout();
    const itLoginResult = await handleLogin('it@example.com', 'password');
    expect(itLoginResult.success).toBe(true);
    
    // 5. Resolve incident
    const resolveResult = await resolveIncident(incidentCode, {
      resolver: 'IT Staff',
      resolution: 'Fixed',
      rootCause: 'Hardware failure'
    });
    expect(resolveResult.success).toBe(true);
    
    // 6. Rate incident
    const rateResult = await rateIncident(incidentCode, 5, 'Test User', 'Great service');
    expect(rateResult.success).toBe(true);
    
    // 7. Verify incident is closed and rated
    const { data: incident } = await supabase
      .from('incidents')
      .select('*')
      .eq('incident_code', incidentCode)
      .single();
    expect(incident.status).toBe('Closed');
    expect(incident.rating).toBe(5);
  });
});
```

### Database Testing

**Test Areas:**
1. RLS policies (verify users can only access authorized data)
2. Database functions (generate_incident_code, calculate_device_age_months)
3. Triggers (updated_at auto-update)
4. Constraints (unique, foreign key, check constraints)

**Example Database Tests:**

```sql
-- Test RLS policies
BEGIN;
  -- Set user context
  SET LOCAL role TO authenticated;
  SET LOCAL request.jwt.claims TO '{"sub": "user-uuid-1"}';
  
  -- Test: User can read own record
  SELECT * FROM users WHERE id = 'user-uuid-1'; -- Should succeed
  
  -- Test: User cannot read other user's record
  SELECT * FROM users WHERE id = 'user-uuid-2'; -- Should return 0 rows
  
  -- Test: User can read all devices
  SELECT * FROM devices; -- Should succeed
  
  -- Test: User can insert incident
  INSERT INTO incidents (incident_code, user_name, ...) VALUES (...); -- Should succeed
  
ROLLBACK;

-- Test generate_incident_code function
SELECT generate_incident_code(); -- Should return INC-2026-001 (or next available)
SELECT generate_incident_code(); -- Should return INC-2026-002

-- Test calculate_device_age_months function
SELECT calculate_device_age_months('2024-01-01'::DATE); -- Should return ~24 months
SELECT calculate_device_age_months(NULL); -- Should return NULL
```

### Performance Testing

**Test Scenarios:**
1. Load testing: 100 concurrent users submitting incidents
2. Database query performance: Measure query execution time
3. Email queue processing: Process 1000 emails
4. Realtime subscription performance: 50 concurrent subscribers

**Example Performance Test:**

```javascript
// tests/performance/load-test.js
import { createClient } from '@supabase/supabase-js';

describe('Performance Tests', () => {
  test('concurrent incident submissions', async () => {
    const promises = [];
    const startTime = Date.now();
    
    // Submit 100 incidents concurrently
    for (let i = 0; i < 100; i++) {
      promises.push(submitIncident({
        userName: `User ${i}`,
        department: 'IT',
        deviceCode: 'TEST001',
        deviceName: 'Test Device',
        description: `Test incident ${i}`,
        severity: 'Cao'
      }));
    }
    
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Verify all submissions succeeded
    const successCount = results.filter(r => r.success).length;
    expect(successCount).toBe(100);
    
    // Verify performance (should complete within 10 seconds)
    expect(duration).toBeLessThan(10000);
    
    console.log(`100 concurrent submissions completed in ${duration}ms`);
  });
  
  test('database query performance', async () => {
    const startTime = Date.now();
    
    // Query open incidents
    const { data } = await supabase
      .from('incidents')
      .select('*')
      .eq('status', 'Open')
      .order('incident_date', { ascending: false })
      .limit(100);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Verify query completes within 500ms
    expect(duration).toBeLessThan(500);
    
    console.log(`Query completed in ${duration}ms, returned ${data.length} rows`);
  });
});
```

### User Acceptance Testing (UAT)

**Test Scenarios:**
1. User can scan QR code and view device info
2. User can login and submit incident report
3. IT staff can view open incidents and resolve them
4. User can rate resolved incidents
5. User can change password
6. Email notifications are received correctly

**UAT Checklist:**

| Test Case | Description | Expected Result | Status |
|-----------|-------------|-----------------|--------|
| UAT-001 | Scan QR code | Device info page displays | ☐ |
| UAT-002 | Login with valid credentials | Main app displays | ☐ |
| UAT-003 | Login with invalid credentials | Error message displays | ☐ |
| UAT-004 | Submit incident report | Success message with incident code | ☐ |
| UAT-005 | View open incidents | List of open incidents displays | ☐ |
| UAT-006 | Resolve incident | Incident status changes to Closed | ☐ |
| UAT-007 | Rate incident | Rating saved successfully | ☐ |
| UAT-008 | Change password | Password updated successfully | ☐ |
| UAT-009 | Receive incident email | Email received within 1 minute | ☐ |
| UAT-010 | Receive resolution email | Email received within 1 minute | ☐ |

### Regression Testing

**Test Areas:**
1. Verify all existing features work after migration
2. Verify QR code URLs still work (backward compatibility)
3. Verify email templates render correctly
4. Verify data integrity after migration

**Regression Test Suite:**

```javascript
// tests/regression/feature-parity.test.js
describe('Feature Parity with Google Apps Script', () => {
  test('incident code format matches', () => {
    const code = generateIncidentCode();
    expect(code).toMatch(/^INC-\d{4}-\d{3}$/);
  });
  
  test('device age calculation matches', () => {
    const age = calculateDeviceAgeMonths('2024-01-01');
    // Compare with Google Apps Script result
    expect(age).toBe(expectedAge);
  });
  
  test('email HTML format matches', () => {
    const html = buildIncidentEmailHtml('INC-2026-001', {...});
    expect(html).toContain('BÁO HỎNG THIẾT BỊ');
    expect(html).toContain('CÔNG TY TNHH CÔNG NGHIỆP THÔNG GIÓ KRUGER VIỆT NAM');
  });
});
```


## Migration Strategy

### Migration Phases

```mermaid
gantt
    title Migration Timeline
    dateFormat YYYY-MM-DD
    section Phase 1: Setup
    Supabase project setup           :p1, 2026-01-01, 2d
    Database schema creation         :p2, after p1, 2d
    RLS policies implementation      :p3, after p2, 1d
    section Phase 2: Data Migration
    Export Google Sheets data        :p4, after p3, 1d
    Transform and validate data      :p5, after p4, 2d
    Import to Supabase              :p6, after p5, 1d
    Verify data integrity           :p7, after p6, 1d
    section Phase 3: Code Migration
    Frontend integration            :p8, after p7, 3d
    Edge Functions development      :p9, after p7, 2d
    Testing and debugging           :p10, after p8, 3d
    section Phase 4: Deployment
    Staging deployment              :p11, after p10, 1d
    UAT testing                     :p12, after p11, 2d
    Production deployment           :p13, after p12, 1d
    Monitoring and support          :p14, after p13, 3d
```

### Phase 1: Supabase Setup

#### 1.1 Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Create new project:
   - Project name: `it-incident-management`
   - Database password: (generate strong password)
   - Region: Southeast Asia (Singapore)
3. Wait for project provisioning (~2 minutes)
4. Note down:
   - Project URL: `https://vjudueltlidywypsktwk.supabase.co`
   - Anon key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Service role key: (keep secret, for admin operations)

#### 1.2 Create Database Schema

Execute SQL scripts in Supabase SQL Editor:

```sql
-- 1. Create tables (users, devices, incidents, email_queue)
-- See "Components and Interfaces" section for full SQL

-- 2. Create indexes
-- See "Components and Interfaces" section for index definitions

-- 3. Create functions
-- See "Components and Interfaces" section for function definitions

-- 4. Enable RLS and create policies
-- See "Components and Interfaces" section for RLS policies

-- 5. Verify schema
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

#### 1.3 Configure Authentication

1. Go to Authentication → Settings
2. Enable Email provider
3. Configure email templates (optional)
4. Set password requirements:
   - Minimum length: 6 characters
5. Configure JWT expiration:
   - Access token: 3600 seconds (1 hour)
   - Refresh token: 2592000 seconds (30 days)

### Phase 2: Data Migration

#### 2.1 Export Data from Google Sheets

**Script: `migration/export-google-sheets.js`**

```javascript
const { google } = require('googleapis');
const fs = require('fs');

const SPREADSHEET_ID = '1z-Z0KxHFY3QJAxNoooMN4Or_Zki0IEfAkmN3YGMeUlQ';
const SHEETS = ['user', 'danh sách thiết bị', 'Incident Log', 'EMAIL_QUEUE'];

async function exportGoogleSheets() {
  // Authenticate with Google Sheets API
  const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  
  const sheets = google.sheets({ version: 'v4', auth });
  
  const exportedData = {};
  
  for (const sheetName of SHEETS) {
    console.log(`Exporting sheet: ${sheetName}`);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`
    });
    
    exportedData[sheetName] = response.data.values;
    console.log(`✅ Exported ${response.data.values.length} rows from ${sheetName}`);
  }
  
  // Save to JSON file
  fs.writeFileSync('migration/exported-data.json', JSON.stringify(exportedData, null, 2));
  console.log('✅ Data exported to migration/exported-data.json');
}

exportGoogleSheets().catch(console.error);
```

#### 2.2 Transform and Validate Data

**Script: `migration/transform-data.js`**

```javascript
const fs = require('fs');

function transformUsers(rows) {
  const [header, ...dataRows] = rows;
  
  return dataRows.map(row => ({
    email: row[0]?.trim(),
    password: row[1]?.trim(), // Will be used for initial Supabase Auth user creation
    name: row[2]?.trim(),
    department: row[3]?.trim(),
    phone: row[4]?.trim() || null,
    access_role: row[5]?.trim() || 'user',
    form_access: row[7]?.trim() || 'báo hỏng, xử lý, đánh giá',
    password_last_changed: row[6] ? new Date(row[6]).toISOString() : null
  })).filter(user => user.email); // Filter out empty rows
}

function transformDevices(rows) {
  const [header, ...dataRows] = rows;
  
  return dataRows.map(row => ({
    code: row[0]?.trim(),
    name: row[1]?.trim(),
    department: row[2]?.trim(),
    purchase_date: row[3] ? formatDate(row[3]) : null,
    status: 'active'
  })).filter(device => device.code);
}

function transformIncidents(rows) {
  const [header, ...dataRows] = rows;
  
  return dataRows.map(row => ({
    incident_code: row[0]?.trim(),
    incident_date: row[1] ? new Date(row[1]).toISOString() : new Date().toISOString(),
    user_name: row[2]?.trim(),
    department: row[3]?.trim(),
    device_code: row[4]?.trim(),
    device_name: row[5]?.trim(),
    description: row[6]?.trim(),
    severity: row[7]?.trim(),
    status: row[8]?.trim() || 'Open',
    resolver: row[9]?.trim() || null,
    resolution: row[10]?.trim() || null,
    root_cause: row[11]?.trim() || null,
    resolve_date: row[12] ? new Date(row[12]).toISOString() : null,
    rating: row[13] ? parseInt(row[13]) : null,
    rater_name: row[14]?.trim() || null,
    attitude_comment: row[15]?.trim() || null
  })).filter(incident => incident.incident_code);
}

function transformEmailQueue(rows) {
  const [header, ...dataRows] = rows;
  
  return dataRows.map(row => ({
    created_at: row[0] ? new Date(row[0]).toISOString() : new Date().toISOString(),
    status: row[1]?.trim() || 'PENDING',
    retry_count: row[2] ? parseInt(row[2]) : 0,
    last_attempt: row[3] ? new Date(row[3]).toISOString() : null,
    subject: row[4]?.trim(),
    to_email: row[5]?.trim(),
    cc_emails: row[6]?.trim() || null,
    html_body: row[7]?.trim(),
    error_log: row[8]?.trim() || null
  })).filter(email => email.subject && email.to_email);
}

function formatDate(dateStr) {
  // Handle various date formats from Google Sheets
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

async function transformData() {
  const rawData = JSON.parse(fs.readFileSync('migration/exported-data.json', 'utf8'));
  
  const transformedData = {
    users: transformUsers(rawData['user']),
    devices: transformDevices(rawData['danh sách thiết bị']),
    incidents: transformIncidents(rawData['Incident Log']),
    email_queue: transformEmailQueue(rawData['EMAIL_QUEUE'])
  };
  
  // Validate data
  console.log('Validation Summary:');
  console.log(`Users: ${transformedData.users.length} records`);
  console.log(`Devices: ${transformedData.devices.length} records`);
  console.log(`Incidents: ${transformedData.incidents.length} records`);
  console.log(`Email Queue: ${transformedData.email_queue.length} records`);
  
  // Check for duplicates
  const userEmails = transformedData.users.map(u => u.email);
  const duplicateEmails = userEmails.filter((e, i) => userEmails.indexOf(e) !== i);
  if (duplicateEmails.length > 0) {
    console.warn('⚠️ Duplicate emails found:', duplicateEmails);
  }
  
  const deviceCodes = transformedData.devices.map(d => d.code);
  const duplicateCodes = deviceCodes.filter((c, i) => deviceCodes.indexOf(c) !== i);
  if (duplicateCodes.length > 0) {
    console.warn('⚠️ Duplicate device codes found:', duplicateCodes);
  }
  
  // Save transformed data
  fs.writeFileSync('migration/transformed-data.json', JSON.stringify(transformedData, null, 2));
  console.log('✅ Data transformed and saved to migration/transformed-data.json');
}

transformData().catch(console.error);
```

#### 2.3 Import Data to Supabase

**Script: `migration/import-to-supabase.js`**

```javascript
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://vjudueltlidywypsktwk.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function importUsers(users) {
  console.log('Importing users...');
  
  for (const user of users) {
    try {
      // Create Supabase Auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password || 'TempPassword123!', // Temporary password
        email_confirm: true,
        user_metadata: {
          name: user.name,
          department: user.department
        }
      });
      
      if (authError) {
        console.error(`❌ Failed to create auth user ${user.email}:`, authError.message);
        continue;
      }
      
      // Insert user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authUser.user.id,
          email: user.email,
          name: user.name,
          department: user.department,
          phone: user.phone,
          access_role: user.access_role,
          form_access: user.form_access,
          password_last_changed: user.password_last_changed
        });
      
      if (profileError) {
        console.error(`❌ Failed to insert user profile ${user.email}:`, profileError.message);
      } else {
        console.log(`✅ Imported user: ${user.email}`);
      }
    } catch (error) {
      console.error(`❌ Error importing user ${user.email}:`, error.message);
    }
  }
}

async function importDevices(devices) {
  console.log('Importing devices...');
  
  // Batch insert (Supabase supports up to 1000 rows per insert)
  const batchSize = 100;
  for (let i = 0; i < devices.length; i += batchSize) {
    const batch = devices.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('devices')
      .insert(batch);
    
    if (error) {
      console.error(`❌ Failed to insert devices batch ${i}-${i + batch.length}:`, error.message);
    } else {
      console.log(`✅ Imported devices: ${i + 1}-${i + batch.length}`);
    }
  }
}

async function importIncidents(incidents) {
  console.log('Importing incidents...');
  
  const batchSize = 100;
  for (let i = 0; i < incidents.length; i += batchSize) {
    const batch = incidents.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('incidents')
      .insert(batch);
    
    if (error) {
      console.error(`❌ Failed to insert incidents batch ${i}-${i + batch.length}:`, error.message);
    } else {
      console.log(`✅ Imported incidents: ${i + 1}-${i + batch.length}`);
    }
  }
}

async function importEmailQueue(emails) {
  console.log('Importing email queue...');
  
  const batchSize = 100;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('email_queue')
      .insert(batch);
    
    if (error) {
      console.error(`❌ Failed to insert email queue batch ${i}-${i + batch.length}:`, error.message);
    } else {
      console.log(`✅ Imported email queue: ${i + 1}-${i + batch.length}`);
    }
  }
}

async function importData() {
  const data = JSON.parse(fs.readFileSync('migration/transformed-data.json', 'utf8'));
  
  // Import in order (users first, then devices, then incidents)
  await importUsers(data.users);
  await importDevices(data.devices);
  await importIncidents(data.incidents);
  await importEmailQueue(data.email_queue);
  
  console.log('✅ Data import completed');
}

importData().catch(console.error);
```

#### 2.4 Verify Data Integrity

**Script: `migration/verify-data.js`**

```javascript
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://vjudueltlidywypsktwk.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verifyData() {
  const originalData = JSON.parse(fs.readFileSync('migration/transformed-data.json', 'utf8'));
  
  // Count records in Supabase
  const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
  const { count: deviceCount } = await supabase.from('devices').select('*', { count: 'exact', head: true });
  const { count: incidentCount } = await supabase.from('incidents').select('*', { count: 'exact', head: true });
  const { count: emailCount } = await supabase.from('email_queue').select('*', { count: 'exact', head: true });
  
  console.log('Data Verification:');
  console.log(`Users: ${userCount} / ${originalData.users.length} (${userCount === originalData.users.length ? '✅' : '❌'})`);
  console.log(`Devices: ${deviceCount} / ${originalData.devices.length} (${deviceCount === originalData.devices.length ? '✅' : '❌'})`);
  console.log(`Incidents: ${incidentCount} / ${originalData.incidents.length} (${incidentCount === originalData.incidents.length ? '✅' : '❌'})`);
  console.log(`Email Queue: ${emailCount} / ${originalData.email_queue.length} (${emailCount === originalData.email_queue.length ? '✅' : '❌'})`);
  
  // Spot check: Verify a few random records
  const randomDevice = originalData.devices[Math.floor(Math.random() * originalData.devices.length)];
  const { data: deviceData } = await supabase
    .from('devices')
    .select('*')
    .eq('code', randomDevice.code)
    .single();
  
  if (deviceData) {
    console.log(`✅ Spot check: Device ${randomDevice.code} found in Supabase`);
  } else {
    console.log(`❌ Spot check: Device ${randomDevice.code} NOT found in Supabase`);
  }
  
  // Check for orphaned incidents (device_code not in devices table)
  const { data: orphanedIncidents } = await supabase
    .from('incidents')
    .select('incident_code, device_code')
    .not('device_code', 'in', `(${originalData.devices.map(d => `'${d.code}'`).join(',')})`);
  
  if (orphanedIncidents && orphanedIncidents.length > 0) {
    console.warn(`⚠️ Found ${orphanedIncidents.length} orphaned incidents (device not found)`);
  } else {
    console.log('✅ No orphaned incidents found');
  }
}

verifyData().catch(console.error);
```

### Phase 3: Code Migration

#### 3.1 Update Frontend (index.html)

**Changes Required:**

1. Add Supabase JavaScript Client library
2. Replace Google Apps Script API calls with Supabase API calls
3. Update authentication logic
4. Update session management
5. Update error handling

**Key Changes:**

```html
<!-- Add Supabase client library -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<script>
  // Initialize Supabase client
  const supabaseUrl = 'https://vjudueltlidywypsktwk.supabase.co';
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
  const supabase = supabase.createClient(supabaseUrl, supabaseAnonKey);
  
  // Replace all google.script.run calls with Supabase API calls
  // See "Components and Interfaces" section for detailed API integration code
</script>
```

#### 3.2 Deploy Edge Functions

**Deploy Email Processor:**

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to project
supabase link --project-ref vjudueltlidywypsktwk

# Deploy Edge Function
supabase functions deploy process-email-queue

# Set environment variables
supabase secrets set SENDGRID_API_KEY=your-sendgrid-api-key
supabase secrets set RESEND_API_KEY=your-resend-api-key
```

#### 3.3 Setup Email Queue Processor Trigger

**Option 1: pg_cron (Recommended)**

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule email processor to run every 1 minute
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

### Phase 4: Testing and Deployment

#### 4.1 Staging Environment Testing

1. Deploy to staging environment (separate Supabase project)
2. Run full test suite (unit, integration, UAT)
3. Perform load testing
4. Verify email delivery
5. Test QR code scanning
6. Test all user workflows

#### 4.2 Production Deployment

**Deployment Checklist:**

- [ ] Database schema created and verified
- [ ] RLS policies enabled and tested
- [ ] Data migration completed and verified
- [ ] Frontend code updated and tested
- [ ] Edge Functions deployed and tested
- [ ] Email queue processor scheduled
- [ ] Environment variables configured
- [ ] Monitoring and logging setup
- [ ] Backup and rollback plan prepared
- [ ] User communication sent

**Deployment Steps:**

1. **Maintenance Window Announcement:**
   - Send email to all users 48 hours before deployment
   - Schedule maintenance window (e.g., Saturday 10 PM - Sunday 2 AM)

2. **Pre-Deployment:**
   - Final backup of Google Sheets data
   - Verify Supabase production environment
   - Test rollback procedure

3. **Deployment:**
   - Put Google Apps Script in read-only mode (optional)
   - Deploy updated frontend (index.html)
   - Enable Supabase as primary backend
   - Monitor for errors

4. **Post-Deployment:**
   - Verify all features working
   - Monitor email queue processing
   - Monitor error logs
   - Respond to user feedback

5. **Rollback Plan (if needed):**
   - Revert frontend to Google Apps Script version
   - Disable Supabase backend
   - Restore Google Sheets data from backup

#### 4.3 Monitoring and Support

**Monitoring Setup:**

1. **Supabase Dashboard:**
   - Monitor database performance
   - Monitor API usage
   - Monitor Edge Function invocations

2. **Error Logging:**
   - Setup Sentry or LogRocket for frontend errors
   - Monitor Supabase logs for backend errors

3. **Email Queue Monitoring:**
   - Create dashboard to monitor email queue status
   - Alert on DEAD emails or high retry counts

4. **User Support:**
   - Provide support channel (email, chat)
   - Document common issues and solutions
   - Collect user feedback

**Post-Migration Support Period:**

- Week 1: Daily monitoring and immediate issue resolution
- Week 2-4: Regular monitoring and issue resolution
- Month 2+: Normal operations with periodic reviews


## Deployment Plan

### Pre-Deployment Checklist

#### Infrastructure Setup
- [ ] Supabase project created and configured
- [ ] Database schema deployed (tables, indexes, functions, triggers)
- [ ] RLS policies enabled and tested
- [ ] Authentication provider configured
- [ ] Edge Functions deployed
- [ ] Environment variables configured
- [ ] Email service (SendGrid/Resend) configured and tested

#### Data Migration
- [ ] Google Sheets data exported
- [ ] Data transformed and validated
- [ ] Data imported to Supabase
- [ ] Data integrity verified (row counts, spot checks)
- [ ] Foreign key relationships verified
- [ ] Test data created for UAT

#### Code Deployment
- [ ] Frontend code updated with Supabase integration
- [ ] All Google Apps Script calls replaced
- [ ] Error handling implemented
- [ ] Session management updated
- [ ] QR code functionality tested
- [ ] Email templates verified

#### Testing
- [ ] Unit tests passed
- [ ] Integration tests passed
- [ ] UAT tests passed
- [ ] Performance tests passed
- [ ] Security tests passed (RLS policies)
- [ ] Email delivery tested
- [ ] QR code scanning tested

#### Documentation
- [ ] User guide updated
- [ ] Admin guide created
- [ ] API documentation created
- [ ] Troubleshooting guide created
- [ ] Rollback procedure documented

#### Communication
- [ ] Maintenance window scheduled
- [ ] User notification email prepared
- [ ] Support team briefed
- [ ] Rollback plan communicated

### Deployment Steps

#### Step 1: Pre-Deployment (T-48 hours)

**Actions:**
1. Send maintenance notification email to all users
2. Create final backup of Google Sheets data
3. Verify staging environment is working
4. Prepare rollback scripts
5. Brief support team on deployment plan

**Email Template:**

```
Subject: [THÔNG BÁO] Nâng cấp hệ thống Báo hỏng - Bảo trì ngày [DATE]

Kính gửi Quý đồng nghiệp,

Hệ thống Báo hỏng thiết bị IT sẽ được nâng cấp lên nền tảng mới để cải thiện hiệu suất và trải nghiệm người dùng.

📅 Thời gian bảo trì: [DATE] từ 22:00 đến 02:00 sáng hôm sau
⏱️ Thời gian dự kiến: 4 giờ

Trong thời gian bảo trì:
- Hệ thống sẽ tạm thời không khả dụng
- Không thể báo hỏng hoặc xử lý sự cố
- Dữ liệu hiện tại sẽ được bảo toàn 100%

Sau khi nâng cấp:
- Giao diện giữ nguyên, dễ sử dụng
- Hiệu suất nhanh hơn
- Tính năng mới: Cập nhật thời gian thực

Nếu có thắc mắc, vui lòng liên hệ: duomle@krugervn.com

Trân trọng,
Bộ phận IT
```

#### Step 2: Deployment Window Start (T-0)

**Actions:**
1. Put Google Apps Script in maintenance mode (optional)
2. Create final snapshot of Google Sheets
3. Verify Supabase production environment
4. Begin deployment

**Maintenance Mode (Optional):**

```javascript
// Add to Code.gs
const MAINTENANCE_MODE = true;

function doGet(e) {
  if (MAINTENANCE_MODE) {
    return HtmlService.createHtmlOutput(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>🔧 Hệ thống đang bảo trì</h1>
          <p>Hệ thống đang được nâng cấp. Vui lòng quay lại sau.</p>
          <p>Thời gian dự kiến: 22:00 - 02:00</p>
        </body>
      </html>
    `).setTitle('Bảo trì hệ thống');
  }
  
  // Normal flow
  return HtmlService.createTemplateFromFile('index').evaluate();
}
```

#### Step 3: Deploy Frontend (T+15 minutes)

**Actions:**
1. Update index.html with Supabase integration
2. Deploy to hosting (Google Apps Script or static hosting)
3. Verify deployment successful
4. Test basic functionality (login, device list)

**Deployment Commands:**

```bash
# If using Google Apps Script
clasp push

# If using static hosting (Netlify, Vercel, etc.)
npm run build
npm run deploy
```

#### Step 4: Enable Supabase Backend (T+30 minutes)

**Actions:**
1. Verify database is accessible
2. Verify RLS policies are active
3. Verify Edge Functions are running
4. Enable email queue processor
5. Test end-to-end flow

**Verification Script:**

```javascript
// Test script: verify-deployment.js
const { createClient } = require('@supabase/supabase-js');

async function verifyDeployment() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  console.log('1. Testing authentication...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'testpassword'
  });
  console.log(authData ? '✅ Auth working' : '❌ Auth failed:', authError);
  
  console.log('2. Testing device list...');
  const { data: devices, error: devicesError } = await supabase.from('devices').select('*').limit(1);
  console.log(devices ? '✅ Devices working' : '❌ Devices failed:', devicesError);
  
  console.log('3. Testing incident submission...');
  const { data: incident, error: incidentError } = await supabase.from('incidents').insert({
    incident_code: 'TEST-001',
    user_name: 'Test User',
    department: 'IT',
    device_code: 'TEST001',
    device_name: 'Test Device',
    description: 'Test incident',
    severity: 'Cao',
    status: 'Open'
  }).select().single();
  console.log(incident ? '✅ Incidents working' : '❌ Incidents failed:', incidentError);
  
  console.log('4. Testing email queue...');
  const { data: email, error: emailError } = await supabase.from('email_queue').insert({
    subject: 'Test Email',
    to_email: 'test@example.com',
    html_body: '<p>Test</p>',
    status: 'PENDING'
  }).select().single();
  console.log(email ? '✅ Email queue working' : '❌ Email queue failed:', emailError);
  
  console.log('5. Testing Edge Function...');
  const response = await fetch('https://vjudueltlidywypsktwk.supabase.co/functions/v1/process-email-queue', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  console.log(response.ok ? '✅ Edge Function working' : '❌ Edge Function failed');
}

verifyDeployment().catch(console.error);
```

#### Step 5: Smoke Testing (T+45 minutes)

**Actions:**
1. Test user login
2. Test QR code scanning
3. Test incident submission
4. Test incident resolution
5. Test incident rating
6. Test password change
7. Verify email delivery

**Smoke Test Checklist:**

| Test | Expected Result | Status |
|------|-----------------|--------|
| Login with valid credentials | Success, main app displays | ☐ |
| Login with invalid credentials | Error message displays | ☐ |
| Scan QR code | Device info page displays | ☐ |
| Submit incident | Success message with incident code | ☐ |
| View open incidents | List displays | ☐ |
| Resolve incident | Status changes to Closed | ☐ |
| Rate incident | Rating saved | ☐ |
| Change password | Password updated | ☐ |
| Receive incident email | Email received within 2 minutes | ☐ |
| Receive resolution email | Email received within 2 minutes | ☐ |

#### Step 6: Monitor and Stabilize (T+1 hour to T+4 hours)

**Actions:**
1. Monitor Supabase dashboard for errors
2. Monitor email queue processing
3. Monitor user activity (if any)
4. Fix any critical issues
5. Document any issues found

**Monitoring Dashboard:**

```sql
-- Query to monitor system health
-- Run in Supabase SQL Editor

-- 1. Check recent incidents
SELECT COUNT(*) as recent_incidents
FROM incidents
WHERE created_at > NOW() - INTERVAL '1 hour';

-- 2. Check email queue status
SELECT status, COUNT(*) as count
FROM email_queue
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY status;

-- 3. Check for errors in email queue
SELECT *
FROM email_queue
WHERE status = 'FAILED' OR status = 'DEAD'
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check recent user activity
SELECT COUNT(DISTINCT user_name) as active_users
FROM incidents
WHERE created_at > NOW() - INTERVAL '1 hour';
```

#### Step 7: Deployment Complete (T+4 hours)

**Actions:**
1. Verify all smoke tests passed
2. Verify no critical errors
3. Send deployment success notification
4. Close maintenance window
5. Begin post-deployment monitoring

**Success Notification Email:**

```
Subject: [HOÀN TẤT] Nâng cấp hệ thống Báo hỏng thành công

Kính gửi Quý đồng nghiệp,

Hệ thống Báo hỏng thiết bị IT đã được nâng cấp thành công.

✅ Hệ thống đã hoạt động trở lại bình thường
✅ Tất cả dữ liệu đã được bảo toàn
✅ Giao diện giữ nguyên, dễ sử dụng

Các cải tiến:
- Hiệu suất nhanh hơn
- Độ tin cậy cao hơn
- Sẵn sàng cho các tính năng mới

Nếu gặp bất kỳ vấn đề nào, vui lòng liên hệ: duomle@krugervn.com

Trân trọng,
Bộ phận IT
```

### Post-Deployment Monitoring

#### Week 1: Intensive Monitoring

**Daily Tasks:**
- [ ] Check Supabase dashboard for errors
- [ ] Monitor email queue processing
- [ ] Review user feedback
- [ ] Fix any issues immediately
- [ ] Document issues and resolutions

**Metrics to Monitor:**
- API response times
- Database query performance
- Email delivery success rate
- User login success rate
- Incident submission success rate
- Error rates

#### Week 2-4: Regular Monitoring

**Weekly Tasks:**
- [ ] Review system performance
- [ ] Analyze user feedback
- [ ] Optimize slow queries
- [ ] Update documentation
- [ ] Plan improvements

#### Month 2+: Normal Operations

**Monthly Tasks:**
- [ ] Review system metrics
- [ ] Plan feature enhancements
- [ ] Update dependencies
- [ ] Backup verification

### Rollback Procedure

**When to Rollback:**
- Critical functionality broken (login, incident submission)
- Data integrity issues
- Performance degradation > 50%
- Email delivery failure > 50%

**Rollback Steps:**

1. **Immediate Actions (T+0):**
   - Announce rollback to support team
   - Put Supabase in maintenance mode

2. **Revert Frontend (T+15 minutes):**
   ```bash
   # Revert to previous Google Apps Script version
   git checkout previous-version
   clasp push
   ```

3. **Restore Google Sheets (T+30 minutes):**
   - Restore from backup if needed
   - Verify data integrity

4. **Verify Rollback (T+45 minutes):**
   - Test all critical functions
   - Verify users can access system

5. **Communicate (T+1 hour):**
   - Send email to users explaining rollback
   - Provide timeline for retry

**Rollback Notification Email:**

```
Subject: [THÔNG BÁO] Hoãn nâng cấp hệ thống Báo hỏng

Kính gửi Quý đồng nghiệp,

Do phát hiện vấn đề kỹ thuật, chúng tôi đã quyết định hoãn việc nâng cấp hệ thống.

✅ Hệ thống đã được khôi phục về phiên bản cũ
✅ Tất cả chức năng hoạt động bình thường
✅ Dữ liệu không bị ảnh hưởng

Chúng tôi sẽ thông báo lại thời gian nâng cấp sau khi khắc phục vấn đề.

Xin lỗi vì sự bất tiện này.

Trân trọng,
Bộ phận IT
```

### Success Criteria

**Deployment is considered successful when:**
- [ ] All smoke tests passed
- [ ] No critical errors in 24 hours
- [ ] Email delivery rate > 95%
- [ ] User login success rate > 99%
- [ ] Incident submission success rate > 99%
- [ ] API response time < 500ms (p95)
- [ ] No user complaints about data loss
- [ ] Support team reports no major issues

### Lessons Learned

**Post-Deployment Review (Week 4):**
- Document what went well
- Document what could be improved
- Update deployment procedures
- Share learnings with team


## Appendix A: SQL Scripts

### Complete Database Setup Script

**File: `supabase/migrations/001_initial_schema.sql`**

```sql
-- ============================================================
-- Supabase Migration: IT Incident Management System
-- Version: 1.0.0
-- Date: 2026-01-01
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USERS TABLE
-- ============================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  phone TEXT,
  access_role TEXT NOT NULL DEFAULT 'user' CHECK (access_role IN ('user', 'manager')),
  form_access TEXT NOT NULL DEFAULT 'báo hỏng, xử lý, đánh giá',
  password_last_changed TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

COMMENT ON TABLE users IS 'User profiles and permissions';
COMMENT ON COLUMN users.access_role IS 'User role: user or manager';
COMMENT ON COLUMN users.form_access IS 'Comma-separated list of form permissions';

-- ============================================================
-- 2. DEVICES TABLE
-- ============================================================

CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  purchase_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'retired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_devices_code ON devices(LOWER(code));
CREATE INDEX idx_devices_department ON devices(department);
CREATE INDEX idx_devices_status ON devices(status);

COMMENT ON TABLE devices IS 'IT equipment inventory';
COMMENT ON COLUMN devices.code IS 'Unique device identifier (e.g., TN141)';
COMMENT ON COLUMN devices.status IS 'Device status: active, inactive, or retired';

-- ============================================================
-- 3. INCIDENTS TABLE
-- ============================================================

CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_code TEXT UNIQUE NOT NULL,
  incident_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_name TEXT NOT NULL,
  department TEXT NOT NULL,
  device_code TEXT NOT NULL,
  device_name TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('Cao', 'Trung bình', 'Thấp')),
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Closed')),
  resolver TEXT,
  resolution TEXT,
  root_cause TEXT,
  resolve_date TIMESTAMPTZ,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  rater_name TEXT,
  attitude_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_incidents_code ON incidents(incident_code);
CREATE INDEX idx_incidents_device_code ON incidents(device_code);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_severity ON incidents(severity);
CREATE INDEX idx_incidents_date ON incidents(incident_date DESC);
CREATE INDEX idx_incidents_unrated ON incidents(device_code, status, rating)
  WHERE status = 'Closed' AND rating IS NULL;

COMMENT ON TABLE incidents IS 'IT incident reports and resolutions';
COMMENT ON COLUMN incidents.incident_code IS 'Unique incident identifier (e.g., INC-2026-001)';
COMMENT ON COLUMN incidents.severity IS 'Incident severity: Cao, Trung bình, or Thấp';
COMMENT ON COLUMN incidents.status IS 'Incident status: Open or Closed';

-- ============================================================
-- 4. EMAIL QUEUE TABLE
-- ============================================================

CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'PENDING' 
    CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'DEAD')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_attempt TIMESTAMPTZ,
  subject TEXT NOT NULL,
  to_email TEXT NOT NULL,
  cc_emails TEXT,
  html_body TEXT NOT NULL,
  error_log TEXT,
  CONSTRAINT chk_retry_count CHECK (retry_count >= 0 AND retry_count <= 3)
);

CREATE INDEX idx_email_queue_status ON email_queue(status, retry_count)
  WHERE status IN ('PENDING', 'FAILED');
CREATE INDEX idx_email_queue_created ON email_queue(created_at DESC);

COMMENT ON TABLE email_queue IS 'Email notification queue with retry logic';
COMMENT ON COLUMN email_queue.status IS 'Email status: PENDING, SENT, FAILED, or DEAD';
COMMENT ON COLUMN email_queue.retry_count IS 'Number of send attempts (max 3)';

-- ============================================================
-- 5. TRIGGERS
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devices_updated_at
  BEFORE UPDATE ON devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at
  BEFORE UPDATE ON incidents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. FUNCTIONS
-- ============================================================

-- Generate incident code (INC-YYYY-XXX)
CREATE OR REPLACE FUNCTION generate_incident_code()
RETURNS TEXT AS $$
DECLARE
  current_year INTEGER;
  max_seq INTEGER;
  next_seq INTEGER;
  seq_str TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW());
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(incident_code FROM 'INC-' || current_year || '-(.*)') AS INTEGER)
  ), 0) INTO max_seq
  FROM incidents
  WHERE incident_code LIKE 'INC-' || current_year || '-%';
  
  next_seq := max_seq + 1;
  seq_str := LPAD(next_seq::TEXT, 3, '0');
  
  RETURN 'INC-' || current_year || '-' || seq_str;
END;
$$ LANGUAGE plpgsql;

-- Calculate device age in months
CREATE OR REPLACE FUNCTION calculate_device_age_months(purchase_date DATE)
RETURNS INTEGER AS $$
BEGIN
  IF purchase_date IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN (
    (EXTRACT(YEAR FROM AGE(CURRENT_DATE, purchase_date)) * 12) +
    EXTRACT(MONTH FROM AGE(CURRENT_DATE, purchase_date))
  )::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Count device repairs
CREATE OR REPLACE FUNCTION count_device_repairs(device_code_param TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM incidents
    WHERE LOWER(device_code) = LOWER(device_code_param)
    AND status = 'Closed'
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can read own record"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own record"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Devices table policies
CREATE POLICY "Authenticated users can read devices"
  ON devices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage devices"
  ON devices FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.access_role = 'manager'
    )
  );

-- Incidents table policies
CREATE POLICY "Authenticated users can read incidents"
  ON incidents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create incidents"
  ON incidents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users with xử lý permission can resolve incidents"
  ON incidents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.form_access LIKE '%xử lý%'
    )
  )
  WITH CHECK (
    (OLD.status = 'Open' AND NEW.status = 'Closed')
    OR (OLD.rating IS NULL AND NEW.rating IS NOT NULL)
  );

CREATE POLICY "Authenticated users can rate incidents"
  ON incidents FOR UPDATE
  TO authenticated
  USING (status = 'Closed' AND rating IS NULL)
  WITH CHECK (rating IS NOT NULL);

-- Email queue policies (service role only)
CREATE POLICY "Service role only"
  ON email_queue FOR ALL
  TO service_role
  USING (true);

-- ============================================================
-- 8. SAMPLE DATA (for testing)
-- ============================================================

-- Insert sample device
INSERT INTO devices (code, name, department, purchase_date, status)
VALUES ('TEST001', 'Test Device', 'IT', '2024-01-01', 'active');

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
```

### Rollback Script

**File: `supabase/migrations/001_rollback.sql`**

```sql
-- ============================================================
-- Rollback Script: Drop all tables and functions
-- ============================================================

-- Drop RLS policies
DROP POLICY IF EXISTS "Users can read own record" ON users;
DROP POLICY IF EXISTS "Users can update own record" ON users;
DROP POLICY IF EXISTS "Authenticated users can read devices" ON devices;
DROP POLICY IF EXISTS "Managers can manage devices" ON devices;
DROP POLICY IF EXISTS "Authenticated users can read incidents" ON incidents;
DROP POLICY IF EXISTS "Authenticated users can create incidents" ON incidents;
DROP POLICY IF EXISTS "Users with xử lý permission can resolve incidents" ON incidents;
DROP POLICY IF EXISTS "Authenticated users can rate incidents" ON incidents;
DROP POLICY IF EXISTS "Service role only" ON email_queue;

-- Drop triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_devices_updated_at ON devices;
DROP TRIGGER IF EXISTS update_incidents_updated_at ON incidents;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS generate_incident_code();
DROP FUNCTION IF EXISTS calculate_device_age_months(DATE);
DROP FUNCTION IF EXISTS count_device_repairs(TEXT);

-- Drop tables
DROP TABLE IF EXISTS email_queue;
DROP TABLE IF EXISTS incidents;
DROP TABLE IF EXISTS devices;
DROP TABLE IF EXISTS users;
```

## Appendix B: Configuration Files

### Environment Variables Template

**File: `.env.example`**

```bash
# Supabase Configuration
SUPABASE_URL=https://vjudueltlidywypsktwk.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Email Service (choose one)
# Option 1: SendGrid
SENDGRID_API_KEY=your-sendgrid-api-key

# Option 2: Resend
RESEND_API_KEY=your-resend-api-key

# Option 3: SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Email Recipients
TO_EMAIL=duomle@krugervn.com
CC_EMAILS=duom1988@gmail.com

# Application Settings
APP_NAME=IT Incident Management
APP_URL=https://your-app-url.com
```

### Supabase Edge Function Config

**File: `supabase/functions/process-email-queue/config.json`**

```json
{
  "name": "process-email-queue",
  "version": "1.0.0",
  "description": "Process email queue and send notifications",
  "runtime": "deno",
  "entrypoint": "index.ts",
  "env": [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SENDGRID_API_KEY",
    "RESEND_API_KEY"
  ],
  "timeout": 60,
  "memory": 256
}
```

### Package.json for Migration Scripts

**File: `migration/package.json`**

```json
{
  "name": "supabase-migration-scripts",
  "version": "1.0.0",
  "description": "Migration scripts for IT Incident Management System",
  "scripts": {
    "export": "node export-google-sheets.js",
    "transform": "node transform-data.js",
    "import": "node import-to-supabase.js",
    "verify": "node verify-data.js",
    "migrate": "npm run export && npm run transform && npm run import && npm run verify"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "googleapis": "^128.0.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.0"
  }
}
```

## Appendix C: Frontend Integration Example

### Complete Frontend Code Snippet

**File: `index-supabase.html` (key changes)**

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IT Incident Management</title>
  
  <!-- Supabase Client Library -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  
  <!-- Existing styles... -->
</head>
<body>
  <!-- Existing HTML structure... -->
  
  <script>
    // ============================================================
    // SUPABASE CONFIGURATION
    // ============================================================
    
    const SUPABASE_URL = 'https://vjudueltlidywypsktwk.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqdWR1ZWx0bGlkeXd5cHNrdHdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMDk5ODgsImV4cCI6MjA5MjU4NTk4OH0.YcnG3XF-sbAQYMH8HreQ7N4wZjiFzxN1oConjR7tcJM';
    
    const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // ============================================================
    // GLOBAL VARIABLES
    // ============================================================
    
    let currentUser = null;
    let currentDeviceCode = null;
    
    // ============================================================
    // INITIALIZATION
    // ============================================================
    
    async function init() {
      // Check for device code in URL
      const urlParams = new URLSearchParams(window.location.search);
      const deviceCode = urlParams.get('id');
      
      if (deviceCode) {
        currentDeviceCode = deviceCode;
        await showDeviceInfoPage(deviceCode);
      } else {
        await checkSession();
      }
    }
    
    // ============================================================
    // AUTHENTICATION
    // ============================================================
    
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        showLoginPage();
        return;
      }
      
      // Fetch user profile
      const { data: userProfile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (error || !userProfile) {
        showLoginPage();
        return;
      }
      
      currentUser = userProfile;
      showMainApp();
    }
    
    async function handleLogin(event) {
      event.preventDefault();
      
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password
        });
        
        if (error) throw error;
        
        // Fetch user profile
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();
        
        if (profileError) throw profileError;
        
        currentUser = userProfile;
        showMainApp();
      } catch (error) {
        document.getElementById('loginError').textContent = handleSupabaseError(error, 'login');
        document.getElementById('loginError').classList.remove('hidden');
      }
    }
    
    async function handleLogout() {
      await supabase.auth.signOut();
      currentUser = null;
      
      if (currentDeviceCode) {
        await showDeviceInfoPage(currentDeviceCode);
      } else {
        window.location.reload();
      }
    }
    
    // ============================================================
    // DEVICE OPERATIONS
    // ============================================================
    
    async function showDeviceInfoPage(deviceCode) {
      try {
        const { data: device, error } = await supabase
          .from('devices')
          .select('*')
          .ilike('code', deviceCode)
          .single();
        
        if (error) throw error;
        
        // Calculate age
        const ageMonths = calculateDeviceAgeMonths(device.purchase_date);
        
        // Get repair count
        const { count } = await supabase
          .from('incidents')
          .select('*', { count: 'exact', head: true })
          .ilike('device_code', deviceCode)
          .eq('status', 'Closed');
        
        // Display device info
        document.getElementById('loginPage').classList.add('hidden');
        document.getElementById('mainApp').classList.add('hidden');
        document.getElementById('deviceInfoPage').classList.remove('hidden');
        
        document.getElementById('infoCode').textContent = device.code;
        document.getElementById('infoName').textContent = device.name;
        document.getElementById('infoDept').textContent = device.department;
        document.getElementById('infoPurchase').textContent = formatDate(device.purchase_date);
        document.getElementById('infoAge').textContent = `${ageMonths} tuổi`;
        document.getElementById('infoRepairCount').textContent = `${count || 0} lần`;
      } catch (error) {
        console.error('Error loading device info:', error);
        document.getElementById('infoCode').textContent = 'Lỗi: ' + handleSupabaseError(error, 'getDeviceInfo');
      }
    }
    
    // ============================================================
    // INCIDENT OPERATIONS
    // ============================================================
    
    async function submitIncident(incidentData) {
      try {
        // Generate incident code
        const { data: incidentCode, error: codeError } = await supabase
          .rpc('generate_incident_code');
        
        if (codeError) throw codeError;
        
        // Insert incident
        const { data, error } = await supabase
          .from('incidents')
          .insert({
            incident_code: incidentCode,
            user_name: incidentData.userName,
            department: incidentData.department,
            device_code: incidentData.deviceCode,
            device_name: incidentData.deviceName,
            description: incidentData.description,
            severity: incidentData.severity,
            status: 'Open'
          })
          .select()
          .single();
        
        if (error) throw error;
        
        // Enqueue email
        await enqueueIncidentEmail(incidentCode, incidentData);
        
        return { success: true, incidentCode: incidentCode };
      } catch (error) {
        return { success: false, error: handleSupabaseError(error, 'submitIncident') };
      }
    }
    
    // ============================================================
    // ERROR HANDLING
    // ============================================================
    
    function handleSupabaseError(error, context) {
      console.error(`Error in ${context}:`, error);
      
      const errorMessages = {
        'Invalid login credentials': 'Email hoặc mật khẩu không đúng',
        'Email not confirmed': 'Email chưa được xác nhận',
        'User already registered': 'Email đã được đăng ký',
        'JWT expired': 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        'Permission denied': 'Bạn không có quyền thực hiện thao tác này'
      };
      
      for (const [key, value] of Object.entries(errorMessages)) {
        if (error.message && error.message.includes(key)) {
          return value;
        }
      }
      
      return error.message || 'Đã xảy ra lỗi. Vui lòng thử lại.';
    }
    
    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================
    
    function calculateDeviceAgeMonths(purchaseDateStr) {
      if (!purchaseDateStr) return 0;
      
      const purchaseDate = new Date(purchaseDateStr);
      const today = new Date();
      
      const months = (today.getFullYear() - purchaseDate.getFullYear()) * 12 +
                     (today.getMonth() - purchaseDate.getMonth());
      
      return Math.max(0, months);
    }
    
    function formatDate(dateStr) {
      if (!dateStr) return '—';
      const date = new Date(dateStr);
      return date.toLocaleDateString('vi-VN');
    }
    
    // ============================================================
    // INITIALIZE ON LOAD
    // ============================================================
    
    window.addEventListener('load', init);
  </script>
</body>
</html>
```

## Summary

This design document provides a comprehensive blueprint for migrating the IT Incident Management System from Google Apps Script to Supabase. The migration preserves 100% feature parity while improving performance, scalability, and maintainability.

**Key Deliverables:**
1. ✅ Database schema with RLS policies
2. ✅ Authentication system using Supabase Auth
3. ✅ Frontend integration with Supabase JavaScript Client
4. ✅ Email service using Edge Functions
5. ✅ Migration scripts and procedures
6. ✅ Testing strategy and deployment plan
7. ✅ Complete SQL scripts and configuration files

**Next Steps:**
1. Review and approve design document
2. Setup Supabase project
3. Execute Phase 1: Database setup
4. Execute Phase 2: Data migration
5. Execute Phase 3: Code migration
6. Execute Phase 4: Testing and deployment

