-- ============================================================
-- Migration: Allow Anonymous Users to Read Devices for QR Codes
-- ============================================================
-- Date: 2026-04-29
-- Purpose: Enable anonymous users to view device information when scanning QR codes
--          This is required for the Device Info Page feature where users scan QR codes
--          before logging in.

-- Add RLS policy to allow anonymous users to read devices table
CREATE POLICY "Anonymous users can read devices for QR codes"
  ON devices FOR SELECT
  TO anon
  USING (true);

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- This policy allows anonymous users (not logged in) to read device information
-- when they scan QR codes. They can only SELECT (read), not INSERT/UPDATE/DELETE.
-- Security: Read-only access is safe for public device information.
