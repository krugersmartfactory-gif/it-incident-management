# Implementation Plan - Device Info Page Bugs

## Overview

This implementation plan addresses three distinct bugs in the IT Incident Management system:
1. **Bug 1**: RLS policy blocks anonymous access to devices table
2. **Bug 2**: No scroll-to-top after login from Device Info Page
3. **Bug 3**: Wrong status filter value in Rate tab ('Đã xử lý' vs 'Closed')

The plan follows the exploratory bugfix workflow: Explore → Preserve → Implement → Validate.

---

## Tasks

- [x] 1. Write bug condition exploration tests (BEFORE implementing fixes)
  - **Property 1: Bug Condition** - Anonymous Device Access, Scroll Position, and Status Filter
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior - they will validate the fixes when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test implementation details from Bug Condition specifications in design:
    - **Bug 1**: Anonymous user (anon role) attempts SELECT on devices table → Should be blocked by RLS policy (will fail on unfixed code)
    - **Bug 2**: User logs in from Device Info Page with device code → Page remains scrolled down (scrollY > 0) (will fail on unfixed code)
    - **Bug 3**: Query for unrated incidents uses `status = 'Đã xử lý'` but database has `status = 'Closed'` → Returns 0 results (will fail on unfixed code)
  - The test assertions should match the Expected Behavior Properties from design:
    - **Bug 1**: Anonymous user should successfully query devices table and receive device data
    - **Bug 2**: After login from Device Info Page, window.scrollY should equal 0
    - **Bug 3**: Query with `status = 'Closed'` should return all unrated closed incidents
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found to understand root cause:
    - **Bug 1**: Record the RLS policy error message (e.g., "new row violates row-level security policy")
    - **Bug 2**: Record the scrollY value after login (e.g., scrollY = 450)
    - **Bug 3**: Record the query result count (e.g., 0 incidents returned when 5 exist with status='Closed')
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

- [~] 2. Write preservation property tests (BEFORE implementing fixes)
  - **Property 2: Preservation** - Authenticated Access, Other Login Flows, and Other Status Values
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - **Authenticated Device Access**: Authenticated users can read devices table → Observe successful query results
    - **Normal Login Flow**: Login from normal login page (not Device Info Page) → Observe scroll behavior (should not trigger scroll-to-top)
    - **Open Incidents**: Incidents with `status = 'Open'` → Observe they are excluded from Rate tab
    - **Rated Incidents**: Incidents with `rating IS NOT NULL` → Observe they are excluded from Rate tab
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - **Property 2a**: For all authenticated users, SELECT queries on devices table should succeed (from Preservation Requirements 3.1, 3.4)
    - **Property 2b**: For all login events NOT from Device Info Page, scroll behavior should remain unchanged (from Preservation Requirements 3.3, 3.10, 3.11)
    - **Property 2c**: For all incidents where status != 'Closed' OR rating IS NOT NULL, they should be excluded from unrated incidents list (from Preservation Requirements 3.7, 3.8)
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12_

- [x] 3. Fix Bug 1: Add RLS policy for anonymous device access

  - [x] 3.1 Create new migration file for RLS policy fix
    - Create file: `supabase/migrations/008_fix_device_rls_for_qr_codes.sql`
    - Add policy allowing anonymous users to read devices table
    - Policy should grant SELECT permission to `anon` role with `USING (true)`
    - _Bug_Condition: isBugCondition1(input) where input.userRole = 'anon' AND input.action = 'SELECT' AND input.table = 'devices'_
    - _Expected_Behavior: Anonymous users can successfully query devices table and receive device data_
    - _Preservation: Authenticated users and managers continue to have existing permissions (Requirements 3.1, 3.2, 3.4, 3.5)_
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

  - [x] 3.2 Apply migration to database
    - Run migration using Supabase CLI or dashboard
    - Verify policy is created successfully
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify bug condition exploration test now passes for Bug 1
    - **Property 1: Expected Behavior** - Anonymous Device Access
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior for Bug 1
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test for Bug 1 from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms Bug 1 is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 Verify preservation tests still pass for authenticated access
    - **Property 2: Preservation** - Authenticated Device Access
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests for authenticated access from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in authenticated access)
    - Confirm authenticated users can still read devices table
    - Confirm managers can still manage devices table
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

- [x] 4. Fix Bug 2: Add scroll-to-top after login from Device Info Page

  - [x] 4.1 Add scroll command in handleDeviceLogin function
    - Open file: `index.html`
    - Locate function: `handleDeviceLogin()` (around line 882)
    - Find the line: `showMainApp();` (around line 1010)
    - Add immediately after: `window.scrollTo(0, 0);`
    - Add comment: `// Scroll to top so user sees pre-filled form`
    - _Bug_Condition: isBugCondition2(input) where input.loginSource = 'deviceInfoPage' AND input.hasDeviceCode = true AND input.loginSuccess = true_
    - _Expected_Behavior: After login from Device Info Page, window.scrollY = 0 and pre-filled form is visible_
    - _Preservation: Other login flows (normal login page) continue to use existing scroll behavior (Requirements 3.3, 3.10, 3.11, 3.12)_
    - _Requirements: 1.4, 1.5, 1.6, 2.4, 2.5, 2.6_

  - [x] 4.2 Verify bug condition exploration test now passes for Bug 2
    - **Property 1: Expected Behavior** - Scroll to Top After Login
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior for Bug 2
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test for Bug 2 from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms Bug 2 is fixed)
    - Verify window.scrollY = 0 after login from Device Info Page
    - Verify pre-filled form is visible in viewport
    - _Requirements: 2.4, 2.5, 2.6_

  - [x] 4.3 Verify preservation tests still pass for other login flows
    - **Property 2: Preservation** - Other Login Flows
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests for other login flows from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in other login flows)
    - Confirm login from normal login page doesn't trigger scroll-to-top
    - Confirm session restoration works as before
    - _Requirements: 3.3, 3.10, 3.11, 3.12_

- [x] 5. Fix Bug 3: Correct status filter value in Rate tab

  - [x] 5.1 Fix status filter in loadUnratedIncidentsForRating function
    - Open file: `index.html`
    - Locate function: `loadUnratedIncidentsForRating()` (around line 1476)
    - Find line: `.eq('status', 'Đã xử lý')` (around line 1480)
    - Change to: `.eq('status', 'Closed')`
    - Add comment: `// ✅ Changed from 'Đã xử lý' to 'Closed' to match database schema`
    - _Bug_Condition: isBugCondition3(input) where input.queryStatusValue = 'Đã xử lý' AND input.actualStatusValue = 'Closed'_
    - _Expected_Behavior: Query returns all incidents where status = 'Closed' AND rating IS NULL_
    - _Preservation: Incidents with other status values continue to be filtered correctly (Requirements 3.7, 3.8, 3.9)_
    - _Requirements: 1.7, 1.8, 1.9, 1.10, 2.7, 2.8, 2.9, 2.10_

  - [x] 5.2 Fix status filter in showDeviceInfoPage function (related bug)
    - Open file: `index.html`
    - Locate function: `showDeviceInfoPage()` (around line 670)
    - Find line: `.eq('status', 'Đã xử lý')` (around line 710)
    - Change to: `.eq('status', 'Closed')`
    - Add comment: `// ✅ Changed from 'Đã xử lý' to 'Closed' to match database schema`
    - This fixes the same bug in the Device Info Page repair count query
    - _Requirements: 1.7, 1.8, 2.7, 2.8_

  - [x] 5.3 Verify bug condition exploration test now passes for Bug 3
    - **Property 1: Expected Behavior** - Correct Status Filter
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior for Bug 3
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test for Bug 3 from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms Bug 3 is fixed)
    - Verify query returns all unrated closed incidents
    - Verify Rate tab displays list of unrated incidents when they exist
    - _Requirements: 2.7, 2.8, 2.9, 2.10_

  - [x] 5.4 Verify preservation tests still pass for other status values
    - **Property 2: Preservation** - Rate Tab Other Queries
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests for other status values from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in filtering logic)
    - Confirm incidents with status = 'Open' are excluded from Rate tab
    - Confirm incidents with rating IS NOT NULL are excluded from Rate tab
    - Confirm rating submission still works correctly
    - _Requirements: 3.7, 3.8, 3.9_

- [~] 6. Integration testing

  - [~] 6.1 Test Bug 1 fix end-to-end
    - Open browser in incognito mode (anonymous user)
    - Navigate to URL with device parameter: `?device=TEST001`
    - Verify Device Info Page loads successfully
    - Verify device information is displayed (code, name, department, purchase date, age, repair count)
    - Verify no RLS policy errors in console
    - _Requirements: 2.1, 2.2, 2.3_

  - [~] 6.2 Test Bug 2 fix end-to-end
    - Open browser in incognito mode
    - Navigate to URL with device parameter: `?device=TEST001`
    - Click "Đăng nhập ngay" button
    - Enter valid credentials and submit login form
    - Verify Main App is displayed
    - Verify page is scrolled to top (Report form is visible)
    - Verify device code and name are pre-filled in Report form
    - _Requirements: 2.4, 2.5, 2.6_

  - [~] 6.3 Test Bug 3 fix end-to-end
    - Create test incident with status = 'Closed' and rating = NULL
    - Log in as user with "đánh giá" permission
    - Switch to "Đánh giá" (Rate) tab
    - Verify unrated incident appears in the list
    - Verify incident code, device code, and description are displayed
    - Verify "Đánh giá" button is present
    - _Requirements: 2.7, 2.8, 2.9_

  - [~] 6.4 Test preservation of authenticated device access
    - Log in as authenticated user
    - Navigate to Device Info Page with device parameter
    - Verify device information loads successfully
    - Log in as manager
    - Verify manager can create, update, and delete devices
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

  - [~] 6.5 Test preservation of other login flows
    - Navigate to normal login page (no device parameter)
    - Enter valid credentials and submit
    - Verify login succeeds
    - Verify no unexpected scroll behavior
    - Refresh page with active session
    - Verify session restoration works correctly
    - _Requirements: 3.3, 3.10, 3.11, 3.12_

  - [~] 6.6 Test preservation of Rate tab filtering
    - Create test incidents with various statuses and ratings:
      - Incident A: status = 'Open', rating = NULL
      - Incident B: status = 'Closed', rating = 5
      - Incident C: status = 'Closed', rating = NULL
    - Switch to Rate tab
    - Verify only Incident C appears in unrated list
    - Verify Incidents A and B are excluded
    - Submit rating for Incident C
    - Verify Incident C disappears from unrated list
    - _Requirements: 3.7, 3.8, 3.9_

- [x] 7. Checkpoint - Ensure all tests pass
  - Run all bug condition exploration tests → All should PASS
  - Run all preservation property tests → All should PASS
  - Run all integration tests → All should PASS
  - Verify no console errors or warnings
  - Verify all three bugs are fixed
  - Verify no regressions in existing functionality
  - If any issues arise, ask the user for guidance

---

## Notes

### Bug Condition Methodology

This implementation follows the bug condition methodology:
- **C(X)**: Bug Condition - identifies inputs that trigger each bug
- **P(result)**: Property - desired behavior for buggy inputs
- **¬C(X)**: Non-buggy inputs that should be preserved
- **F**: Original (unfixed) function
- **F'**: Fixed function

### Test Execution Order

1. **Exploration Tests (Task 1)**: Run BEFORE fixes → Should FAIL (confirms bugs exist)
2. **Preservation Tests (Task 2)**: Run BEFORE fixes → Should PASS (confirms baseline behavior)
3. **Implementation (Tasks 3-5)**: Apply fixes
4. **Fix Checking (Tasks 3.3, 4.2, 5.3)**: Re-run exploration tests → Should PASS (confirms fixes work)
5. **Preservation Checking (Tasks 3.4, 4.3, 5.4)**: Re-run preservation tests → Should PASS (confirms no regressions)
6. **Integration Testing (Task 6)**: End-to-end validation

### Files to Modify

- `supabase/migrations/008_fix_device_rls_for_qr_codes.sql` (new file) - RLS policy fix
- `index.html` - Scroll behavior and status filter fixes

### Migration Strategy

**For Bug 1 (RLS Policy):**
- Create new migration file to allow rollback if needed
- Apply migration to database using Supabase CLI or dashboard

**For Bugs 2 and 3 (JavaScript):**
- Direct edits to `index.html`
- Changes take effect immediately on next page load
