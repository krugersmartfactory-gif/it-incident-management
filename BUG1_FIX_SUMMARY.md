# Bug 1 Fix Summary - Device Query Column Name

## Issue
The frontend code was using the wrong column name when querying the `devices` table:
- **Database column**: `code` (and `name`)
- **Frontend queries**: `device_code` (and `device_name`)

This caused all device queries to return `null` because the column name didn't match.

## Root Cause
The original bug report incorrectly identified this as an RLS policy issue. The actual problem was a column name mismatch between the database schema and the frontend code.

## Changes Made

### 1. Fixed Query Column Names (4 locations)

#### Location 1: QR Scanner Query (line ~479)
```javascript
// ❌ BEFORE
.eq('device_code', decodedText)

// ✅ AFTER
.eq('code', decodedText)
```

#### Location 2: Device Info Page Query (line ~697)
```javascript
// ❌ BEFORE
.eq('device_code', deviceCode)

// ✅ AFTER
.eq('code', deviceCode)
```

#### Location 3: handleDeviceLogin Query (line ~1010)
```javascript
// ❌ BEFORE
.eq('device_code', currentDeviceCode)

// ✅ AFTER
.eq('code', currentDeviceCode)
```

#### Location 4: loadDeviceInfoForReport Query (line ~1040)
```javascript
// ❌ BEFORE
.eq('device_code', deviceCode)

// ✅ AFTER
.eq('code', deviceCode)
```

### 2. Fixed Device Property References (5 locations)

#### Location 1: QR Scanner Auto-fill (line ~484)
```javascript
// ❌ BEFORE
device.device_name

// ✅ AFTER
device.name
```

#### Location 2: Device Info Page Display (line ~752)
```javascript
// ❌ BEFORE
device.device_name

// ✅ AFTER
device.name
```

#### Location 3: handleDeviceLogin Pre-fill (lines ~1015-1019)
```javascript
// ❌ BEFORE
device.device_code
device.device_name

// ✅ AFTER
device.code
device.name
```

#### Location 4: loadDeviceInfoForReport Auto-fill (line ~1044)
```javascript
// ❌ BEFORE
device.device_name

// ✅ AFTER
device.name
```

## Database Schema Reference

From `supabase/migrations/001_initial_schema.sql`:
```sql
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,           -- ✅ Column is 'code'
  name TEXT NOT NULL,                  -- ✅ Column is 'name'
  department TEXT NOT NULL,
  purchase_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'retired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Expected Behavior After Fix

1. **Anonymous users** can successfully query the devices table using the correct column name
2. **Device Info Page** displays device information correctly when accessed via QR code
3. **QR code scanning** works for anonymous users and returns device data
4. **Login from Device Info Page** pre-fills the correct device code and name

## Verification

Run the verification script:
```bash
node verify-bug1-fix.js
```

Or test manually:
1. Open `test-device-info-bugs.html` in a browser
2. Run the Bug 1 test
3. The query should now succeed (assuming devices exist in the database)

## Notes

- **No RLS migration needed**: The database schema and RLS policies are correct
- **No migration file created**: This is a frontend-only fix
- **All changes in**: `index.html`
- **Total changes**: 4 query fixes + 5 property reference fixes = 9 changes

## Task Status

✅ **Task 3 Complete**: Fixed Bug 1 by correcting column names in device queries
- ✅ Fixed 4 query locations to use `.eq('code', ...)` instead of `.eq('device_code', ...)`
- ✅ Fixed 5 property references to use `device.code` and `device.name`
- ✅ Verified queries now use correct column names matching database schema
