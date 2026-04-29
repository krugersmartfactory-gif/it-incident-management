# Device Info Page Bugs - Bugfix Design

## Overview

This design addresses three distinct bugs in the IT Incident Management system that affect the Device Info Page and Rate Tab functionality:

1. **Bug 1 - RLS Policy Blocks Anonymous Access**: The Row Level Security (RLS) policy on the `devices` table requires authentication, preventing anonymous users from viewing device information via QR codes.

2. **Bug 2 - No Scroll After Login**: When users log in from the Device Info Page, the system switches to the Main App and pre-fills the Report form, but the page remains scrolled down, hiding the pre-filled information from view.

3. **Bug 3 - Wrong Status Filter in Rate Tab**: The `loadUnratedIncidentsForRating()` function queries for incidents with status `'Đã xử lý'` (Vietnamese for "Resolved"), but the actual database value is `'Closed'` (English), causing the query to return zero results even when unrated incidents exist.

The fix strategy is minimal and targeted: update the RLS policy to allow anonymous reads, add scroll-to-top behavior after login, and correct the status filter value.

## Glossary

- **Bug_Condition (C)**: The specific conditions that trigger each bug
- **Property (P)**: The desired correct behavior when the bug condition is met
- **Preservation**: Existing functionality that must remain unchanged by the fixes
- **RLS (Row Level Security)**: Supabase/PostgreSQL security feature that controls row-level access to tables
- **Anonymous User**: A user who has not logged in, accessing the system with the `anon` role
- **Authenticated User**: A user who has logged in, accessing the system with the `authenticated` role
- **Device Info Page**: The public page displayed when scanning a QR code with URL parameter `?device=CODE`
- **Main App**: The authenticated application interface with tabs for Report, Process, Rate, and Admin
- **currentDeviceCode**: Global JavaScript variable storing the device code from QR scan

## Bug Details

### Bug 1: RLS Policy Blocks Anonymous Access

#### Bug Condition

The bug manifests when an anonymous user (not logged in) attempts to view device information by scanning a QR code. The `showDeviceInfoPage()` function queries the `devices` table, but the RLS policy blocks the query because it requires the `authenticated` role.

**Formal Specification:**
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

#### Examples

- **Example 1**: User scans QR code `https://it-incident-management.vercel.app/?device=TN141` → Device query fails with permission error → Device info shows "Đang tải..." indefinitely
- **Example 2**: Anonymous user accesses `?device=TEST001` → Console shows RLS policy error → Device information fields display "—" or error messages
- **Example 3**: Authenticated user scans same QR code → Device info loads successfully (no bug for authenticated users)
- **Edge Case**: Device code doesn't exist in database → Should show "Không tìm thấy thiết bị" message (not affected by this bug)

### Bug 2: No Scroll After Login

#### Bug Condition

The bug manifests when a user successfully logs in from the Device Info Page. The `handleDeviceLogin()` function calls `showMainApp()` and pre-fills the device code and name in the Report form, but does not scroll the page to the top, leaving the pre-filled form fields below the viewport.

**Formal Specification:**
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

#### Examples

- **Example 1**: User scans QR code → Clicks "Đăng nhập ngay" → Enters credentials → Login succeeds → Main App shows but user sees bottom of page, must scroll up to see pre-filled form
- **Example 2**: User on Device Info Page → Logs in with valid credentials → Device code "TN141" and device name "Laptop Dell" are pre-filled → User doesn't see the pre-filled values without scrolling
- **Example 3**: User logs in from normal login page (not Device Info Page) → No device code to pre-fill → Scroll behavior doesn't matter (not affected by this bug)
- **Edge Case**: User logs in from Device Info Page but device code is invalid → Form is pre-filled with device code only → Still needs scroll to see it

### Bug 3: Wrong Status Filter in Rate Tab

#### Bug Condition

The bug manifests when a user switches to the "Đánh giá" (Rate) tab. The `loadUnratedIncidentsForRating()` function queries for incidents with `status = 'Đã xử lý'`, but the actual database column stores the English value `'Closed'`, causing the query to return zero results.

**Formal Specification:**
```
FUNCTION isBugCondition3(input)
  INPUT: input of type { queryStatusValue: string, actualStatusValue: string }
  OUTPUT: boolean
  
  RETURN input.queryStatusValue = 'Đã xử lý'
         AND input.actualStatusValue = 'Closed'
         AND input.queryStatusValue != input.actualStatusValue
END FUNCTION
```

#### Examples

- **Example 1**: Database has 5 incidents with `status = 'Closed'` and `rating IS NULL` → User switches to Rate tab → Query filters by `status = 'Đã xử lý'` → Returns 0 results → Shows "✅ Tất cả sự cố đã được đánh giá!" (incorrect)
- **Example 2**: User resolves an incident → Status changes to `'Closed'` → User switches to Rate tab → Incident doesn't appear in unrated list (should appear)
- **Example 3**: If database had incidents with `status = 'Đã xử lý'` (Vietnamese) → Query would work correctly (but database uses English values)
- **Edge Case**: Incident has `status = 'Open'` → Should not appear in unrated list regardless of rating value (correct behavior, not affected by bug)

## Expected Behavior

### Bug 1: RLS Policy Allows Anonymous Access

**Correct Behavior:**
When an anonymous user scans a QR code with a device parameter, the system SHALL successfully query the `devices` table and display device information without requiring authentication. The RLS policy SHALL allow `anon` role to perform SELECT operations on the `devices` table.

**Implementation:**
Add a new RLS policy to the `devices` table that allows anonymous users to read device information:

```sql
CREATE POLICY "Anonymous users can read devices for QR codes"
  ON devices FOR SELECT
  TO anon
  USING (true);
```

This policy grants read-only access to all device records for anonymous users, enabling the public QR code feature while maintaining security (no write access).

### Bug 2: Page Scrolls to Top After Login

**Correct Behavior:**
When a user successfully logs in from the Device Info Page, the system SHALL switch to Main App, pre-fill the device information in the Report form, AND automatically scroll to the top of the page so the user immediately sees the pre-filled form.

**Implementation:**
Add `window.scrollTo(0, 0)` after calling `showMainApp()` in the `handleDeviceLogin()` function:

```javascript
// Switch to main app and pre-fill device info
showMainApp();

// Scroll to top so user sees pre-filled form
window.scrollTo(0, 0);
```

This ensures the viewport is positioned at the top of the page, making the pre-filled Report form immediately visible.

### Bug 3: Correct Status Filter Value

**Correct Behavior:**
When a user switches to the "Đánh giá" tab, the `loadUnratedIncidentsForRating()` function SHALL query for incidents with `status = 'Closed'` (matching the actual database value) and `rating IS NULL`, returning all unrated closed incidents.

**Implementation:**
Change the status filter from `'Đã xử lý'` to `'Closed'` in the query:

```javascript
const { data: unratedIncidents, error } = await supabaseClient
  .from('incidents')
  .select('*')
  .eq('status', 'Closed')  // ✅ Changed from 'Đã xử lý' to 'Closed'
  .is('rating', null)
  .order('resolve_date', { ascending: false });
```

This matches the actual database schema where incident status values are stored in English (`'Open'` and `'Closed'`).

### Preservation Requirements

**Unchanged Behaviors:**

**Authentication and Authorization:**
- Authenticated users SHALL CONTINUE TO access the devices table with existing permissions
- Managers SHALL CONTINUE TO perform full CRUD operations on devices based on their role
- User login with valid credentials SHALL CONTINUE TO authenticate and load profiles correctly

**Device Info Page for Authenticated Users:**
- Authenticated users viewing Device Info Page SHALL CONTINUE TO see all device information correctly
- Device repair count and unrated incident count calculations SHALL CONTINUE TO use existing query logic
- "Đăng nhập ngay" button SHALL CONTINUE TO show the login form

**Rate Tab for Other Status Values:**
- Incidents with `status = 'Open'` SHALL CONTINUE TO be excluded from unrated incidents list
- Incidents with a rating value SHALL CONTINUE TO be excluded from unrated incidents list
- Rating submission SHALL CONTINUE TO update incident with rating, rater_name, and attitude_comment

**Report Form Behavior:**
- Manual device information entry SHALL CONTINUE TO work correctly
- QR code scanning while logged in SHALL CONTINUE TO auto-fill device information
- Report submission SHALL CONTINUE TO generate incident codes and insert records correctly

**Scroll Behavior in Other Contexts:**
- Login from normal login page SHALL NOT trigger scroll-to-top (no device code context)
- Tab switching within Main App SHALL CONTINUE TO use existing scroll behavior
- Form submissions SHALL CONTINUE TO use existing scroll behavior

**Scope:**
All inputs that do NOT involve the three specific bug conditions should be completely unaffected by these fixes. This includes:
- All other RLS policies on users, incidents, and email_queue tables
- All other login flows (normal login page, session restoration)
- All other queries in the Rate tab (rated incidents, incident submission)
- All other Device Info Page functionality (unrated incidents display, login form display)

## Hypothesized Root Cause

### Bug 1: RLS Policy Blocks Anonymous Access

**Root Cause Analysis:**

1. **Missing RLS Policy for Anonymous Role**: The `devices` table has RLS enabled with two policies:
   - "Authenticated users can read devices" - allows `authenticated` role to SELECT
   - "Managers can manage devices" - allows managers to perform all operations
   
   There is NO policy allowing the `anon` role to read devices, causing all anonymous queries to be blocked.

2. **Design Oversight**: The original schema was designed for authenticated-only access, but the QR code feature was added later requiring public device information access. The RLS policies were not updated to accommodate this new requirement.

3. **Security-First Approach**: The default RLS behavior is to deny all access unless explicitly allowed. This is correct security practice, but requires explicit policies for each role that needs access.

### Bug 2: No Scroll After Login

**Root Cause Analysis:**

1. **Missing Scroll Command**: The `handleDeviceLogin()` function successfully switches to Main App and pre-fills the form, but does not include any scroll-to-top command. The browser maintains the scroll position from the Device Info Page.

2. **UI State Transition**: When switching from Device Info Page (which may be scrolled down to the login form) to Main App, the browser preserves the scroll position, leaving the user at the bottom of the new page.

3. **User Experience Oversight**: The developer focused on the data flow (login → pre-fill form) but didn't consider the viewport position, assuming users would naturally scroll up or that the page would reset automatically.

### Bug 3: Wrong Status Filter Value

**Root Cause Analysis:**

1. **Language Mismatch**: The database schema uses English values (`'Open'`, `'Closed'`) for the `status` column, but the JavaScript code uses Vietnamese values (`'Đã xử lý'`) in the query filter.

2. **Inconsistent Codebase**: Other parts of the codebase correctly use `'Closed'`:
   - `showDeviceInfoPage()` queries with `.eq('status', 'Đã xử lý')` (also incorrect)
   - `handleRateSubmit()` queries with `.eq('status', 'Closed')` (correct)
   - Database schema defines `CHECK (status IN ('Open', 'Closed'))` (English values)

3. **Copy-Paste Error**: The `loadUnratedIncidentsForRating()` function likely copied query logic from `showDeviceInfoPage()`, propagating the same Vietnamese status value error.

4. **Lack of Constants**: The codebase uses string literals for status values instead of constants, making it easy to introduce typos and inconsistencies.

## Correctness Properties

Property 1: Bug Condition 1 - Anonymous Device Access

_For any_ query where an anonymous user (with `anon` role) attempts to SELECT from the `devices` table, the fixed RLS policy SHALL allow the query to succeed and return device information without requiring authentication.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Bug Condition 2 - Scroll to Top After Login

_For any_ login event where the user logs in from the Device Info Page with a valid device code, the fixed `handleDeviceLogin()` function SHALL scroll the page to the top (scrollY = 0) after switching to Main App, making the pre-filled Report form immediately visible.

**Validates: Requirements 2.4, 2.5, 2.6**

Property 3: Bug Condition 3 - Correct Status Filter

_For any_ query in the Rate tab for unrated incidents, the fixed `loadUnratedIncidentsForRating()` function SHALL filter by `status = 'Closed'` (matching the database schema) and return all incidents where `status = 'Closed'` AND `rating IS NULL`.

**Validates: Requirements 2.7, 2.8, 2.9, 2.10**

Property 4: Preservation - Authenticated Device Access

_For any_ query where an authenticated user attempts to SELECT from the `devices` table, the system SHALL produce exactly the same result as before the fix, preserving existing authenticated access permissions.

**Validates: Requirements 3.1, 3.2, 3.4, 3.5**

Property 5: Preservation - Other Login Flows

_For any_ login event that does NOT originate from the Device Info Page (e.g., normal login page), the system SHALL produce exactly the same behavior as before the fix, preserving existing login and scroll behavior.

**Validates: Requirements 3.3, 3.10, 3.11, 3.12**

Property 6: Preservation - Rate Tab Other Queries

_For any_ incident that does NOT meet the bug condition (e.g., `status = 'Open'` or `rating IS NOT NULL`), the Rate tab SHALL produce exactly the same behavior as before the fix, preserving existing filtering logic.

**Validates: Requirements 3.7, 3.8, 3.9**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct, we need to make three independent changes:

#### Bug 1: Add RLS Policy for Anonymous Access

**File**: `supabase/migrations/001_initial_schema.sql`

**Location**: After the existing "Authenticated users can read devices" policy (around line 120)

**Specific Changes**:
1. **Add New RLS Policy**: Insert a new policy allowing anonymous users to read devices:
   ```sql
   CREATE POLICY "Anonymous users can read devices for QR codes"
     ON devices FOR SELECT
     TO anon
     USING (true);
   ```

2. **Policy Explanation**: This policy grants read-only (SELECT) access to all device records for the `anon` role, enabling public QR code access while maintaining security (no INSERT, UPDATE, or DELETE permissions).

3. **No Changes to Existing Policies**: The existing "Authenticated users can read devices" and "Managers can manage devices" policies remain unchanged.

**Alternative Approach**: If we want to restrict anonymous access to only specific columns (e.g., exclude internal notes), we could modify the policy to use column-level security, but this is not required based on the current requirements.

#### Bug 2: Add Scroll-to-Top After Login

**File**: `index.html`

**Function**: `handleDeviceLogin()`

**Location**: After the line `showMainApp();` (around line 1010)

**Specific Changes**:
1. **Add Scroll Command**: Insert `window.scrollTo(0, 0);` immediately after `showMainApp();`:
   ```javascript
   // Switch to main app and pre-fill device info
   showMainApp();
   
   // Scroll to top so user sees pre-filled form
   window.scrollTo(0, 0);
   ```

2. **Placement Rationale**: The scroll must happen AFTER `showMainApp()` because:
   - `showMainApp()` changes the visible page (hides Device Info Page, shows Main App)
   - Scrolling before the page switch would scroll the wrong page
   - Scrolling after ensures the Main App is scrolled to the top

3. **No Changes to Other Login Flows**: The normal login page handler (`handleLogin()`) does not need this change because it doesn't have a device code context.

#### Bug 3: Fix Status Filter Value

**File**: `index.html`

**Function**: `loadUnratedIncidentsForRating()`

**Location**: Line 1480 (the `.eq('status', 'Đã xử lý')` line)

**Specific Changes**:
1. **Change Status Value**: Replace `'Đã xử lý'` with `'Closed'`:
   ```javascript
   const { data: unratedIncidents, error } = await supabaseClient
     .from('incidents')
     .select('*')
     .eq('status', 'Closed')  // ✅ Changed from 'Đã xử lý'
     .is('rating', null)
     .order('resolve_date', { ascending: false });
   ```

2. **Fix Related Query**: The `showDeviceInfoPage()` function has the same bug on line 710. Change:
   ```javascript
   .eq('status', 'Closed')  // ✅ Changed from 'Đá xử lý'
   ```

3. **Consider Adding Constants**: For future maintainability, consider defining status constants:
   ```javascript
   const INCIDENT_STATUS = {
     OPEN: 'Open',
     CLOSED: 'Closed'
   };
   ```
   Then use `INCIDENT_STATUS.CLOSED` instead of string literals. However, this is an enhancement beyond the minimal bug fix.

### Migration Strategy

**For Bug 1 (RLS Policy):**
- Create a new migration file: `supabase/migrations/008_fix_device_rls_for_qr_codes.sql`
- This allows the fix to be applied to existing databases without modifying the original schema
- The migration can be rolled back if needed by dropping the policy

**For Bugs 2 and 3 (JavaScript):**
- Direct edits to `index.html`
- No migration needed (frontend code)
- Changes take effect immediately on next page load

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate each bug on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fixes. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

#### Bug 1: RLS Policy Test

**Test Plan**: Attempt to query the `devices` table as an anonymous user (without authentication) and observe the permission denied error. Use Supabase client with only the anon key (no auth session).

**Test Cases**:
1. **Anonymous Device Query**: Create a test script that queries devices table without authentication (will fail on unfixed code with RLS error)
2. **Authenticated Device Query**: Query devices table with authenticated user (should succeed on unfixed code)
3. **Console Error Inspection**: Open browser console, scan QR code, observe RLS policy error in network tab (will show 400/403 error on unfixed code)

**Expected Counterexamples**:
- Query fails with error message like "new row violates row-level security policy" or "permission denied for table devices"
- Network tab shows 400 or 403 status code for devices query
- Device Info Page displays "Đang tải..." indefinitely or shows error message

#### Bug 2: Scroll Position Test

**Test Plan**: Log in from Device Info Page and observe the scroll position after login. Measure `window.scrollY` value before and after login.

**Test Cases**:
1. **Device Info Login Scroll**: Scroll down to login form on Device Info Page, log in, observe that page remains scrolled down (will fail on unfixed code - scrollY > 0)
2. **Normal Login Scroll**: Log in from normal login page, observe scroll position (should be 0, not affected by bug)
3. **Form Visibility Test**: After login from Device Info Page, check if pre-filled form is visible without manual scrolling (will fail on unfixed code)

**Expected Counterexamples**:
- After login from Device Info Page, `window.scrollY` is greater than 0 (page is scrolled down)
- Pre-filled device code and name are not visible in viewport
- User must manually scroll up to see the Report form

#### Bug 3: Status Filter Test

**Test Plan**: Create test incidents with `status = 'Closed'` and `rating IS NULL`, then switch to Rate tab and observe that the query returns zero results due to wrong status filter.

**Test Cases**:
1. **Unrated Closed Incidents Query**: Query database directly for incidents with `status = 'Closed'` AND `rating IS NULL` (should return results)
2. **Rate Tab Display**: Switch to Rate tab, observe that it shows "✅ Tất cả sự cố đã được đánh giá!" even though unrated incidents exist (will fail on unfixed code)
3. **Console Query Inspection**: Open browser console, switch to Rate tab, observe the query uses `status = 'Đã xử lý'` in network tab (will show 0 results on unfixed code)

**Expected Counterexamples**:
- Direct database query returns N incidents with `status = 'Closed'` AND `rating IS NULL`
- Rate tab query with `status = 'Đã xử lý'` returns 0 incidents
- Rate tab displays "all rated" message when unrated incidents actually exist

### Fix Checking

**Goal**: Verify that for all inputs where each bug condition holds, the fixed functions produce the expected behavior.

#### Bug 1: Anonymous Access Fix Checking

**Pseudocode:**
```
FOR ALL query WHERE isBugCondition1(query) DO
  result := executeQuery_fixed(query)
  ASSERT result.success = true
  ASSERT result.data IS NOT NULL
  ASSERT result.error IS NULL
END FOR
```

**Test Cases:**
- Anonymous user queries devices table → Should succeed and return device data
- Device Info Page loads for anonymous user → Should display device information
- QR code scan by anonymous user → Should show device code, name, department, purchase date, age, repair count

#### Bug 2: Scroll Fix Checking

**Pseudocode:**
```
FOR ALL login WHERE isBugCondition2(login) DO
  scrollY_before := window.scrollY
  result := handleDeviceLogin_fixed(login)
  scrollY_after := window.scrollY
  ASSERT scrollY_after = 0
  ASSERT formIsVisible()
END FOR
```

**Test Cases:**
- Login from Device Info Page with device code → Should scroll to top (scrollY = 0)
- Pre-filled form should be visible in viewport without manual scrolling
- Device code and name should be visible immediately after login

#### Bug 3: Status Filter Fix Checking

**Pseudocode:**
```
FOR ALL query WHERE isBugCondition3(query) DO
  result := loadUnratedIncidentsForRating_fixed()
  expected := queryDatabase('status = Closed AND rating IS NULL')
  ASSERT result.length = expected.length
  ASSERT result.incident_codes = expected.incident_codes
END FOR
```

**Test Cases:**
- Rate tab loads with unrated closed incidents in database → Should display list of unrated incidents
- Rate tab loads with no unrated incidents → Should display "✅ Tất cả sự cố đã được đánh giá!"
- Query should use `status = 'Closed'` matching database schema

### Preservation Checking

**Goal**: Verify that for all inputs where the bug conditions do NOT hold, the fixed functions produce the same result as the original functions.

#### Preservation Test 1: Authenticated Device Access

**Pseudocode:**
```
FOR ALL query WHERE NOT isBugCondition1(query) DO
  ASSERT executeQuery_original(query) = executeQuery_fixed(query)
END FOR
```

**Testing Approach**: Property-based testing is recommended because:
- It generates many test cases automatically across different user roles and query types
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that authenticated access is unchanged

**Test Plan**: Observe behavior on UNFIXED code first for authenticated device queries, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Authenticated User Device Query**: Verify authenticated users can still read devices table
2. **Manager Device CRUD**: Verify managers can still create, update, delete devices
3. **Device Info Page for Authenticated Users**: Verify authenticated users see same device info as before

#### Preservation Test 2: Other Login Flows

**Pseudocode:**
```
FOR ALL login WHERE NOT isBugCondition2(login) DO
  ASSERT handleLogin_original(login) = handleLogin_fixed(login)
END FOR
```

**Test Plan**: Observe behavior on UNFIXED code first for normal login page, then verify it remains unchanged after fix.

**Test Cases**:
1. **Normal Login Page**: Verify login from normal login page doesn't trigger scroll-to-top
2. **Login Without Device Code**: Verify login without device code context works as before
3. **Session Restoration**: Verify automatic session restoration on page load works as before

#### Preservation Test 3: Rate Tab Other Queries

**Pseudocode:**
```
FOR ALL incident WHERE NOT isBugCondition3(incident) DO
  ASSERT shouldAppearInRateTab_original(incident) = shouldAppearInRateTab_fixed(incident)
END FOR
```

**Test Plan**: Observe behavior on UNFIXED code first for incidents with different status values, then verify filtering logic remains unchanged.

**Test Cases**:
1. **Open Incidents**: Verify incidents with `status = 'Open'` are excluded from Rate tab
2. **Rated Incidents**: Verify incidents with `rating IS NOT NULL` are excluded from Rate tab
3. **Rating Submission**: Verify rating submission updates incident correctly

### Unit Tests

**Bug 1: RLS Policy**
- Test anonymous user can read devices table
- Test authenticated user can still read devices table
- Test manager can still manage devices table
- Test anonymous user cannot write to devices table

**Bug 2: Scroll Behavior**
- Test `window.scrollY = 0` after login from Device Info Page
- Test scroll position unchanged after login from normal login page
- Test pre-filled form is visible after login from Device Info Page

**Bug 3: Status Filter**
- Test query uses `status = 'Closed'` in Rate tab
- Test unrated closed incidents appear in Rate tab
- Test open incidents don't appear in Rate tab
- Test rated incidents don't appear in Rate tab

### Property-Based Tests

**Bug 1: RLS Policy**
- Generate random device codes and verify anonymous users can read them
- Generate random user roles and verify only managers can write devices
- Test across many device records to ensure policy applies consistently

**Bug 2: Scroll Behavior**
- Generate random login scenarios (with/without device code) and verify scroll behavior
- Generate random device codes and verify form pre-fill + scroll works correctly
- Test across many login attempts to ensure scroll is consistent

**Bug 3: Status Filter**
- Generate random incident statuses and ratings, verify correct filtering
- Generate random closed incidents without ratings, verify they appear in Rate tab
- Test across many incident records to ensure query is consistent

### Integration Tests

**Bug 1: RLS Policy**
- Full QR code scan flow: scan code → view device info → verify data displayed
- Anonymous user flow: access device URL → verify device info loads → verify no authentication required
- Authenticated user flow: login → scan QR code → verify device info still works

**Bug 2: Scroll Behavior**
- Full login flow from Device Info Page: scan QR → click login → enter credentials → verify scroll to top → verify form visible
- Full login flow from normal page: access login page → enter credentials → verify no unexpected scroll
- Device code pre-fill flow: scan QR → login → verify device code and name pre-filled → verify form visible

**Bug 3: Status Filter**
- Full incident lifecycle: create incident → resolve incident → switch to Rate tab → verify incident appears → submit rating → verify incident disappears
- Full Rate tab flow: switch to Rate tab → verify unrated incidents list → click "Đánh giá" button → verify form pre-filled → submit rating
- Multiple incidents flow: create multiple closed incidents → verify all appear in Rate tab → rate some → verify only unrated ones remain
