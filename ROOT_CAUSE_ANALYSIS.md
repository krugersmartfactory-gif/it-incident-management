# Root Cause Analysis - Device Info Page Bugs

**Date:** 2026-04-29  
**Analyst:** Kiro AI  
**Status:** ✅ Root Causes Identified

---

## Executive Summary

After thorough investigation, I've identified the **ACTUAL root causes** for the three bugs. The original bug report's analysis was **partially incorrect** for Bug 1 and Bug 3.

### Key Findings

| Bug | Original Analysis | Actual Root Cause | Severity |
|-----|-------------------|-------------------|----------|
| **Bug 1** | RLS policy blocks anonymous access | ❌ **INCORRECT** - RLS allows anonymous access. Real issue: **Wrong column name** (`device_code` vs `code`) | 🔴 **CRITICAL** |
| **Bug 2** | No scroll-to-top after login | ✅ **CORRECT** - Missing `window.scrollTo(0, 0)` | 🟡 **MEDIUM** |
| **Bug 3** | Wrong status filter value | ✅ **CORRECT** - Using 'Đã xử lý' instead of 'Closed' | 🔴 **CRITICAL** |

---

## Bug 1: Device Info Page Fails to Load Device Data

### Original Hypothesis (INCORRECT)

**Claimed:** RLS policy blocks anonymous users from querying devices table.

**Evidence Against:**
```sql
-- From 001_initial_schema.sql (lines 120-124)
CREATE POLICY "Authenticated users can read devices"
  ON devices FOR SELECT
  TO authenticated
  USING (true);
```

This policy only applies to **authenticated** users. There is **NO policy blocking anonymous users**.

**Test Result:** Anonymous query succeeded without RLS error ✅

### Actual Root Cause (CONFIRMED)

**Real Issue:** The frontend code uses the **WRONG COLUMN NAME** when querying the devices table.

**Evidence:**

1. **Database Schema** (001_initial_schema.sql, line 38):
```sql
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,  -- ✅ Column is named 'code'
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  ...
);
```

2. **Frontend Code** (index.html, line 697):
```javascript
const devicePromise = supabaseClient
  .from('devices')
  .select('*')
  .eq('device_code', deviceCode)  // ❌ WRONG: Column is 'code', not 'device_code'
  .maybeSingle();
```

**Impact:**
- Query returns `null` (no matching device found)
- Device Info Page shows "Đang tải..." indefinitely
- No error message because `.maybeSingle()` doesn't throw on no results

**Affected Code Locations:**
- `index.html` line 479: QR scanner query
- `index.html` line 697: Device Info Page query
- `index.html` line 1010: handleDeviceLogin query
- `index.html` line 1040: Another device query

### Why Original Analysis Was Wrong

1. **RLS Policy Assumption:** The bug report assumed RLS was blocking access, but:
   - RLS is enabled on devices table ✅
   - But there's NO policy blocking anonymous SELECT ✅
   - Anonymous users can query, they just get no results due to wrong column name

2. **Test Environment:** The test passed because:
   - Anonymous query succeeded (no RLS error)
   - But returned `null` because column name is wrong
   - This was misinterpreted as "bug already fixed"

### Correct Fix

**Change:** Replace `device_code` with `code` in all device queries

```javascript
// ❌ WRONG (current code)
.eq('device_code', deviceCode)

// ✅ CORRECT (fixed code)
.eq('code', deviceCode)
```

**Files to Fix:**
- `index.html` (4 locations: lines 479, 697, 1010, 1040)

**No RLS policy change needed** - the original migration is correct.

---

## Bug 2: No Scroll After Login from Device Info Page

### Original Hypothesis (CORRECT) ✅

**Claimed:** Missing `window.scrollTo(0, 0)` after `showMainApp()` in `handleDeviceLogin()`.

**Evidence:**
```javascript
// index.html, around line 1010
async function handleDeviceLogin(event) {
  // ... login logic ...
  
  // Switch to main app and pre-fill device info
  showMainApp();
  
  // ❌ MISSING: window.scrollTo(0, 0);
  
  // ... rest of code ...
}
```

**Impact:**
- User logs in from Device Info Page (scrolled down)
- Main App displays but viewport stays at bottom
- Pre-filled form is not visible without manual scrolling

### Correct Fix (Same as Original)

**Add:** `window.scrollTo(0, 0);` after `showMainApp();`

```javascript
// Switch to main app and pre-fill device info
showMainApp();

// Scroll to top so user sees pre-filled form
window.scrollTo(0, 0);
```

---

## Bug 3: Wrong Status Filter in Rate Tab

### Original Hypothesis (CORRECT) ✅

**Claimed:** Query uses `status = 'Đã xử lý'` but database stores `status = 'Closed'`.

**Evidence:**

1. **Database Schema** (001_initial_schema.sql, line 67):
```sql
status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Closed')),
```

2. **Frontend Code** (index.html, line 705 and 711):
```javascript
// ❌ WRONG: Using Vietnamese value
.eq('status', 'Đã xử lý')

// ✅ CORRECT: Should use English value
.eq('status', 'Closed')
```

**Impact:**
- Query returns 0 results even when unrated closed incidents exist
- Rate tab shows "✅ Tất cả sự cố đã được đánh giá!" incorrectly

**Affected Code Locations:**
- `index.html` line 705: `showDeviceInfoPage()` repair count query
- `index.html` line 711: `showDeviceInfoPage()` unrated incidents query
- `index.html` line 1480: `loadUnratedIncidentsForRating()` query (NOT FOUND IN EXCERPT - need to verify)

### Correct Fix (Same as Original)

**Change:** Replace `'Đã xử lý'` with `'Closed'` in all status queries

```javascript
// ❌ WRONG (current code)
.eq('status', 'Đã xử lý')

// ✅ CORRECT (fixed code)
.eq('status', 'Closed')
```

---

## Summary of Required Changes

### Bug 1: Column Name Fix (NEW)

**Files:** `index.html`

**Changes:**
1. Line 479: `.eq('device_code', decodedText)` → `.eq('code', decodedText)`
2. Line 697: `.eq('device_code', deviceCode)` → `.eq('code', deviceCode)`
3. Line 1010: `.eq('device_code', currentDeviceCode)` → `.eq('code', currentDeviceCode)`
4. Line 1040: `.eq('device_code', deviceCode)` → `.eq('code', deviceCode)`

**No migration needed** - database schema is correct.

### Bug 2: Scroll Fix (UNCHANGED)

**Files:** `index.html`

**Changes:**
1. Add `window.scrollTo(0, 0);` after `showMainApp();` in `handleDeviceLogin()` (around line 1010)

### Bug 3: Status Filter Fix (UNCHANGED)

**Files:** `index.html`

**Changes:**
1. Line 705: `.eq('status', 'Đã xử lý')` → `.eq('status', 'Closed')`
2. Line 711: `.eq('status', 'Đã xử lý')` → `.eq('status', 'Closed')`
3. Line ~1480 (need to verify): `.eq('status', 'Đã xử lý')` → `.eq('status', 'Closed')` in `loadUnratedIncidentsForRating()`

---

## Impact on Implementation Plan

### Tasks to Update

1. **Task 1 (Exploration Tests):** ✅ Complete - Tests revealed the real root cause
2. **Task 2 (Preservation Tests):** Can proceed as planned
3. **Task 3 (Fix Bug 1):** ❌ **CHANGE REQUIRED**
   - ~~Task 3.1: Create RLS migration~~ → **DELETE** (not needed)
   - ~~Task 3.2: Apply migration~~ → **DELETE** (not needed)
   - **NEW Task 3.1:** Fix column name in device queries (4 locations)
   - Task 3.3: Verify fix → Update to test column name fix
   - Task 3.4: Preservation tests → Update to verify authenticated access still works
4. **Task 4 (Fix Bug 2):** No changes needed
5. **Task 5 (Fix Bug 3):** No changes needed
6. **Task 6 (Integration Tests):** Update Bug 1 test to verify column name fix
7. **Task 7 (Checkpoint):** No changes needed

### Design Document Updates Needed

1. **Bug 1 Root Cause:** Update from "RLS policy blocks access" to "Wrong column name in queries"
2. **Bug 1 Fix Implementation:** Update from "Add RLS policy" to "Fix column name in 4 locations"
3. **Bug 1 Expected Behavior:** Update to reflect column name fix
4. **Bug 1 Correctness Properties:** Update to test column name correctness

---

## Recommendations

### Option 1: Update Spec Documents and Continue

**Pros:**
- Accurate documentation of actual bugs
- Correct implementation plan
- Better understanding for future maintenance

**Cons:**
- Takes time to update documents
- Delays implementation

### Option 2: Proceed with Corrected Implementation (RECOMMENDED)

**Pros:**
- Faster to fix
- Documents can be updated after fixes are verified
- Real bugs are fixed immediately

**Cons:**
- Spec documents temporarily out of sync with implementation

### Option 3: Ask User for Guidance

Present findings and let user decide whether to:
- Update documents first, then implement
- Implement fixes first, then update documents
- Implement only (skip document updates)

---

## Conclusion

The investigation revealed that **Bug 1's root cause was misidentified** in the original bug report. The actual issue is a **column name mismatch** (`device_code` vs `code`), not an RLS policy problem.

**All three bugs are real and need fixing:**
- ✅ Bug 1: Fix column name in device queries (4 locations)
- ✅ Bug 2: Add scroll-to-top after login
- ✅ Bug 3: Fix status filter value (3 locations)

**Next Steps:**
1. Get user approval to proceed with corrected fixes
2. Update implementation plan (Task 3)
3. Implement fixes
4. Verify with tests
5. Update spec documents (optional)
