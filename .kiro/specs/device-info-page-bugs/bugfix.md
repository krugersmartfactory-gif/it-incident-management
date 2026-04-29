# Bugfix Requirements Document

## Introduction

This document describes three bugs in the IT Incident Management system related to the Device Info Page and Rate Tab functionality. These bugs prevent anonymous users from viewing device information via QR codes, cause poor user experience after login, and prevent users from seeing unrated incidents in the Rate tab.

## Bug Analysis

### Current Behavior (Defect)

#### Bug 1: Device Info Page RLS Policy

1.1 WHEN an anonymous user (not logged in) scans a QR code with URL `https://it-incident-management.vercel.app/?device=TN141` THEN the Device Info Page displays but device information fails to load with a 400 error or permission denied error

1.2 WHEN an anonymous user attempts to view device information THEN the RLS policy in `supabase/migrations/001_initial_schema.sql` blocks the query because it requires `authenticated` role to read from the `devices` table

1.3 WHEN the device query fails due to RLS policy THEN the console shows error messages and the device information fields display "Đang tải..." indefinitely or show error messages

#### Bug 2: Scroll Position After Login

1.4 WHEN a user logs in from the Device Info Page THEN the system switches to Main App and pre-fills the device code and device name in the Report form

1.5 WHEN the Main App is displayed after login THEN the user must manually scroll up to see the pre-filled form fields

1.6 WHEN the form is pre-filled but not visible THEN the user may not realize the device information has been loaded and may re-enter it manually

#### Bug 3: Rate Tab Unrated Incidents List

1.7 WHEN a user switches to the "Đánh giá" (Rate) tab THEN the `loadUnratedIncidentsForRating()` function is called

1.8 WHEN `loadUnratedIncidentsForRating()` queries for unrated incidents THEN it filters by `status = 'Đã xử lý'` but the actual status value in the database is `'Closed'`

1.9 WHEN the status filter doesn't match any records THEN the function returns zero incidents even when unrated closed incidents exist in the database

1.10 WHEN zero incidents are returned THEN the Rate tab displays "✅ Tất cả sự cố đã được đánh giá!" even though there are actually unrated incidents

### Expected Behavior (Correct)

#### Bug 1: Device Info Page RLS Policy

2.1 WHEN an anonymous user scans a QR code with a device parameter THEN the system SHALL successfully load and display device information from the `devices` table without requiring authentication

2.2 WHEN the RLS policy is updated THEN it SHALL allow anonymous users (with `anon` role) to read device information for public QR code access

2.3 WHEN device information is successfully loaded THEN the Device Info Page SHALL display device code, name, department, purchase date, age, repair count, and unrated incident count

#### Bug 2: Scroll Position After Login

2.4 WHEN a user successfully logs in from the Device Info Page THEN the system SHALL switch to Main App, pre-fill the device information, AND automatically scroll to the top of the page

2.5 WHEN the page scrolls to the top THEN the user SHALL immediately see the pre-filled Report form without manual scrolling

2.6 WHEN the form is visible THEN the user SHALL clearly see that device information has been automatically loaded from the QR code

#### Bug 3: Rate Tab Unrated Incidents List

2.7 WHEN a user switches to the "Đánh giá" tab THEN the `loadUnratedIncidentsForRating()` function SHALL query for incidents with `status = 'Closed'` (not 'Đã xử lý')

2.8 WHEN the query uses the correct status value THEN it SHALL return all closed incidents where `rating IS NULL`

2.9 WHEN unrated incidents exist THEN the Rate tab SHALL display a list showing incident code, device code, description, and a "Đánh giá" button for each incident

2.10 WHEN no unrated incidents exist THEN the Rate tab SHALL display "✅ Tất cả sự cố đã được đánh giá!"

### Unchanged Behavior (Regression Prevention)

#### Authentication and Authorization

3.1 WHEN authenticated users access the devices table THEN the system SHALL CONTINUE TO allow read access as before

3.2 WHEN managers attempt to manage devices THEN the system SHALL CONTINUE TO allow full CRUD operations based on their role

3.3 WHEN users log in with valid credentials THEN the system SHALL CONTINUE TO authenticate and load user profiles correctly

#### Device Info Page for Authenticated Users

3.4 WHEN an authenticated user views the Device Info Page THEN the system SHALL CONTINUE TO display all device information correctly

3.5 WHEN device repair count and unrated incident count are calculated THEN the system SHALL CONTINUE TO use the existing query logic

3.6 WHEN a user clicks "Đăng nhập ngay" on the Device Info Page THEN the system SHALL CONTINUE TO show the login form

#### Rate Tab for Other Status Values

3.7 WHEN incidents have status 'Open' THEN they SHALL CONTINUE TO be excluded from the unrated incidents list

3.8 WHEN incidents have a rating value THEN they SHALL CONTINUE TO be excluded from the unrated incidents list

3.9 WHEN a user submits a rating THEN the system SHALL CONTINUE TO update the incident with rating, rater_name, and attitude_comment

#### Report Form Behavior

3.10 WHEN a user manually enters device information THEN the system SHALL CONTINUE TO accept and process the report

3.11 WHEN a user scans a QR code while already logged in THEN the system SHALL CONTINUE TO auto-fill device information

3.12 WHEN a report is submitted THEN the system SHALL CONTINUE TO generate incident codes and insert records correctly
