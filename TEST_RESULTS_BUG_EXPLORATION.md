# Bug Condition Exploration Test Results

**Spec:** device-info-page-bugs  
**Task:** Task 1 - Write bug condition exploration tests (BEFORE implementing fixes)  
**Date:** 2026-04-29  
**Status:** Tests Created and Executed

## ⚠️ CRITICAL FINDINGS

**Test Execution Date:** 2026-04-29

### Summary of Test Results

| Bug | Expected Result | Actual Result | Status |
|-----|----------------|---------------|--------|
| Bug 1: RLS Policy | ❌ Should FAIL (RLS blocks access) | ✅ PASSED (Anonymous access works) | ⚠️ UNEXPECTED PASS |
| Bug 2: Scroll Position | ❌ Should FAIL (No scroll-to-top) | ⏸️ Manual test required | ⏸️ NOT TESTED |
| Bug 3: Status Filter | ❌ Should FAIL (Wrong status value) | ⚠️ Cannot test (No data) | ⚠️ NO TEST DATA |

### Key Findings

1. **Bug 1 (RLS Policy):** The test PASSED unexpectedly. Anonymous users CAN query the devices table without RLS errors. This suggests:
   - The bug might already be fixed, OR
   - The RLS policy was never configured to block anonymous access, OR
   - The bug report's root cause analysis is incorrect

2. **Bug 3 (Status Filter):** Cannot be tested because the database has no incidents. Need to create test data.

3. **Bug 2 (Scroll Position):** Requires manual browser testing.

### Recommended Actions

**Option 1: Continue Anyway**
- Proceed with implementing the fixes as specified in the design document
- The fixes may be preventive (ensuring bugs don't occur) rather than corrective

**Option 2: Re-investigate**
- Investigate the actual root causes by examining the codebase more carefully
- Update the bug report and design document based on findings
- Create test data to properly test Bug 3

**Option 3: Ask User for Guidance**
- Present findings to the user
- Ask whether to proceed with fixes or re-investigate

---

## Overview

This document describes the bug condition exploration tests for three bugs in the IT Incident Management system. These tests are designed to **FAIL on unfixed code** to confirm the bugs exist.

## Test File

**Location:** `test-device-info-bugs.html`

**How to Run:**
1. Open `test-device-info-bugs.html` in a web browser
2. Run each test individually or click "Run All Tests"
3. Document the counterexamples found

## Test Cases

### Bug 1: RLS Policy Blocks Anonymous Device Access

**Property:** Anonymous Device Query  
**Validates Requirements:** 1.1, 1.2, 1.3, 2.1, 2.2, 2.3

**Bug Condition:**
```
FUNCTION isBugCondition1(input)
  INPUT: input of type { userRole: string, action: string, table: string }
  OUTPUT: boolean
  
  RETURN input.userRole = 'anon'
         AND input.action = 'SELECT'
         AND input.table = 'devices'
         AND NOT policyAllowsAccess(input)
END FUNCTION
```

**Test Implementation:**
- Uses Supabase client with ONLY anon key (no auth session)
- Attempts to query devices table with device code
- On unfixed code: Should FAIL with RLS policy error

**Expected Counterexample (Unfixed Code):**
```json
{
  "deviceCode": "TN141",
  "errorMessage": "new row violates row-level security policy for table \"devices\"",
  "errorCode": "42501",
  "errorDetails": "Policy violation",
  "timestamp": "2025-01-XX..."
}
```

**Expected Behavior After Fix:**
- Query succeeds and returns device data
- No RLS policy error

---

### Bug 2: No Scroll After Login from Device Info Page

**Property:** Scroll Position After Login  
**Validates Requirements:** 1.4, 1.5, 1.6, 2.4, 2.5, 2.6

**Bug Condition:**
```
FUNCTION isBugCondition2(input)
  INPUT: input of type { loginSource: string, hasDeviceCode: boolean, loginSuccess: boolean }
  OUTPUT: boolean
  
  RETURN input.loginSource = 'deviceInfoPage'
         AND input.hasDeviceCode = true
         AND input.loginSuccess = true
         AND NOT pageScrolledToTop()
END FUNCTION
```

**Test Implementation:**
- Simulates Device Info Page with device code
- User scrolls down to login form
- User logs in successfully
- Measures window.scrollY before and after login
- On unfixed code: scrollY should remain > 0 (page stays scrolled down)

**Expected Counterexample (Unfixed Code):**
```json
{
  "deviceCode": "TN141",
  "scrollBeforeLogin": 450,
  "scrollAfterLogin": 450,
  "scrollChanged": false,
  "timestamp": "2025-01-XX..."
}
```

**Expected Behavior After Fix:**
- window.scrollY equals 0 after login
- Pre-filled form is visible in viewport

**Note:** This test requires manual interaction in the browser.

---

### Bug 3: Wrong Status Filter in Rate Tab

**Property:** Status Filter Query  
**Validates Requirements:** 1.7, 1.8, 1.9, 1.10, 2.7, 2.8, 2.9, 2.10

**Bug Condition:**
```
FUNCTION isBugCondition3(input)
  INPUT: input of type { queryStatusValue: string, actualStatusValue: string }
  OUTPUT: boolean
  
  RETURN input.queryStatusValue = 'Đã xử lý'
         AND input.actualStatusValue = 'Closed'
         AND input.queryStatusValue != input.actualStatusValue
END FUNCTION
```

**Test Implementation:**
- Queries incidents table with status = 'Closed' AND rating IS NULL (correct query)
- Queries incidents table with status = 'Đã xử lý' AND rating IS NULL (buggy query)
- Compares result counts
- On unfixed code: Buggy query should return 0, correct query should return > 0

**Expected Counterexample (Unfixed Code):**
```json
{
  "correctStatusValue": "Closed",
  "buggyStatusValue": "Đã xử lý",
  "correctQueryCount": 5,
  "buggyQueryCount": 0,
  "discrepancy": 5,
  "timestamp": "2025-01-XX..."
}
```

**Expected Behavior After Fix:**
- Query uses status = 'Closed' to match database schema
- Returns all unrated closed incidents

---

## Test Execution Instructions

### Prerequisites
1. Ensure Supabase database is running and accessible
2. Ensure there are test devices in the `devices` table (e.g., device code "TN141")
3. Ensure there are test incidents with status = 'Closed' and rating IS NULL

### Running the Tests

**Option 1: Browser-Based Tests (Recommended)**
1. Open `test-device-info-bugs.html` in a web browser
2. Click "Run All Tests" or run each test individually
3. Document the counterexamples displayed in the test results

**Option 2: Manual Testing**
1. For Bug 1: Open browser console, try to query devices table as anonymous user
2. For Bug 2: Navigate to Device Info Page, scroll down, log in, observe scroll position
3. For Bug 3: Open Rate tab, observe that unrated incidents don't appear

### Expected Test Results (Unfixed Code)

| Test | Expected Result | Status Badge |
|------|----------------|--------------|
| Bug 1: Anonymous Device Access | ✅ Expected Fail (Bug Confirmed) | Expected Fail ✓ |
| Bug 2: Scroll Position | ✅ Expected Fail (Bug Confirmed) | Expected Fail ✓ |
| Bug 3: Status Filter | ✅ Expected Fail (Bug Confirmed) | Expected Fail ✓ |

**Success Criteria:** All 3 tests FAIL with clear counterexamples demonstrating the bugs exist.

---

## Counterexamples Documentation

### Bug 1 Counterexample
**Status:** ⚠️ UNEXPECTED PASS - Bug NOT confirmed

**Test Date:** 2026-04-29

**Observed Behavior:**
- [x] Anonymous device query SUCCEEDED (no RLS error)
- [x] Query returned: null (device not found, but no permission error)
- [x] Error code: None
- [x] Device code tested: TN141

**Analysis:**
The anonymous user was able to query the devices table without encountering an RLS policy error. This suggests:
1. Bug 1 might already be fixed (RLS policy allows anonymous access), OR
2. The RLS policy was never properly configured to block anonymous access

**Database State:**
- Devices table: 0 devices found
- The database is empty, so we cannot test with actual device data

**Conclusion:**
Bug 1 CANNOT BE CONFIRMED with current database state. The RLS policy appears to allow anonymous SELECT access to the devices table.

### Bug 2 Counterexample
**Status:** ⏸️ Manual test required

**Observed Behavior:**
- [ ] Scroll position before login: _______________
- [ ] Scroll position after login: _______________
- [ ] Device code tested: _______________

**Note:** This test requires browser DOM manipulation and must be run manually using `test-device-info-bugs.html`.

### Bug 3 Counterexample
**Status:** ⚠️ CANNOT BE TESTED - No test data

**Test Date:** 2026-04-29

**Observed Behavior:**
- [x] Correct query count (status = 'Closed'): 0 incidents
- [x] Buggy query count (status = 'Đã xử lý'): 0 incidents
- [x] Discrepancy: 0 incidents

**Analysis:**
Both queries returned 0 results because there are no incidents in the database. We cannot confirm or refute Bug 3 without test data.

**Database State:**
- Incidents table: 0 incidents found
- Unrated closed incidents: 0 found

**Conclusion:**
Bug 3 CANNOT BE TESTED without creating test incidents with status = 'Closed' and rating IS NULL.
- [ ] Correct query count (status = 'Closed'): _______________
- [ ] Buggy query count (status = 'Đã xử lý'): _______________
- [ ] Discrepancy: _______________

---

## Next Steps

After running the tests and documenting counterexamples:

1. ✅ **Task 1 Complete:** Bug condition exploration tests written and run
2. ⏭️ **Task 2:** Write preservation property tests
3. ⏭️ **Task 3:** Implement Bug 1 fix (RLS policy)
4. ⏭️ **Task 4:** Implement Bug 2 fix (scroll-to-top)
5. ⏭️ **Task 5:** Implement Bug 3 fix (status filter)

**IMPORTANT:** Do NOT implement fixes until all exploration tests are run and counterexamples are documented.

---

## Test Maintenance

**When to Update Tests:**
- After implementing fixes, re-run tests to verify they now PASS
- If tests pass unexpectedly on unfixed code, investigate root cause
- Update counterexample documentation with actual observed values

**Test File Location:**
- Browser tests: `test-device-info-bugs.html`
- Test documentation: `TEST_RESULTS_BUG_EXPLORATION.md` (this file)
