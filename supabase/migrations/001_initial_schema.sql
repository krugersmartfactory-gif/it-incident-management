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
