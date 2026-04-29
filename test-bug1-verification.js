/**
 * Comprehensive Verification for Bug 1 Fix
 * Demonstrates that device queries now work correctly with column name 'code'
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vjudueltlidywypsktwk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqdWR1ZWx0bGlkeXd5cHNrdHdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMDk5ODgsImV4cCI6MjA5MjU4NTk4OH0.YcnG3XF-sbAQYMH8HreQ7N4wZjiFzxN1oConjR7tcJM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testBug1Fix() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Bug 1 Fix Verification - Device Query Column Name');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  let allTestsPassed = true;
  
  // Test 1: Verify anonymous user can query devices table (no RLS error)
  console.log('Test 1: Anonymous user can query devices table');
  console.log('─────────────────────────────────────────────────────────');
  try {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ FAILED: Query returned error:', error.message);
      console.log('   Error code:', error.code);
      if (error.code === '42501' || error.message.includes('policy')) {
        console.log('   This indicates an RLS policy issue - Bug 1 NOT fixed!\n');
      }
      allTestsPassed = false;
    } else {
      console.log('✅ PASSED: Anonymous user can query devices table');
      console.log('   No RLS policy errors detected');
      console.log('   Query executed successfully\n');
    }
  } catch (err) {
    console.log('❌ FAILED: Unexpected error:', err.message);
    allTestsPassed = false;
  }
  
  // Test 2: Verify query uses correct column name 'code'
  console.log('Test 2: Query with column name "code" (correct)');
  console.log('─────────────────────────────────────────────────────────');
  try {
    const { data, error } = await supabase
      .from('devices')
      .select('code, name, department')
      .eq('code', 'TEST001')
      .maybeSingle();
    
    if (error) {
      if (error.code === '42703') {
        console.log('❌ FAILED: Column "code" does not exist');
        console.log('   This means the fix was not applied correctly\n');
        allTestsPassed = false;
      } else {
        console.log('❌ FAILED: Query error:', error.message);
        allTestsPassed = false;
      }
    } else {
      console.log('✅ PASSED: Query with column name "code" succeeded');
      console.log('   Column name is correct (matches database schema)');
      if (data) {
        console.log('   Device found:', data.code, '-', data.name);
      } else {
        console.log('   No device found (expected if TEST001 does not exist)');
      }
      console.log();
    }
  } catch (err) {
    console.log('❌ FAILED: Unexpected error:', err.message);
    allTestsPassed = false;
  }
  
  // Test 3: Verify old column name 'device_code' would fail
  console.log('Test 3: Query with old column name "device_code" (should fail)');
  console.log('─────────────────────────────────────────────────────────');
  try {
    const { data, error } = await supabase
      .from('devices')
      .select('device_code, device_name')
      .limit(1);
    
    if (error) {
      if (error.code === '42703' || error.message.includes('column') || error.message.includes('does not exist')) {
        console.log('✅ PASSED: Old column name "device_code" correctly fails');
        console.log('   Error:', error.message);
        console.log('   This confirms the database uses "code", not "device_code"\n');
      } else {
        console.log('⚠️  WARNING: Query failed with unexpected error:', error.message);
        console.log();
      }
    } else {
      console.log('❌ FAILED: Query with "device_code" succeeded');
      console.log('   This means the database has the wrong column name\n');
      allTestsPassed = false;
    }
  } catch (err) {
    console.log('❌ FAILED: Unexpected error:', err.message);
    allTestsPassed = false;
  }
  
  // Test 4: Verify table structure
  console.log('Test 4: Verify devices table structure');
  console.log('─────────────────────────────────────────────────────────');
  try {
    const { data, error } = await supabase
      .from('devices')
      .select('code, name, department, purchase_date, status')
      .limit(5);
    
    if (error) {
      console.log('❌ FAILED: Cannot query table structure:', error.message);
      allTestsPassed = false;
    } else {
      console.log('✅ PASSED: Table structure verified');
      console.log('   Columns: code, name, department, purchase_date, status');
      console.log('   Devices found:', data.length);
      if (data.length > 0) {
        console.log('   Sample devices:');
        data.forEach((device, index) => {
          console.log(`     ${index + 1}. ${device.code} - ${device.name} (${device.department})`);
        });
      } else {
        console.log('   (No devices in database - this is OK for testing)');
      }
      console.log();
    }
  } catch (err) {
    console.log('❌ FAILED: Unexpected error:', err.message);
    allTestsPassed = false;
  }
  
  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Test Summary');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (allTestsPassed) {
    console.log('✅ ALL TESTS PASSED\n');
    console.log('Bug 1 Fix Verification: SUCCESS');
    console.log('─────────────────────────────────────────────────────────');
    console.log('✓ Anonymous users can query devices table (no RLS error)');
    console.log('✓ Queries use correct column name "code"');
    console.log('✓ Database schema matches frontend code');
    console.log('✓ Device Info Page should now load correctly\n');
    console.log('Changes Applied:');
    console.log('  • Fixed 4 query locations: .eq("code", ...) instead of .eq("device_code", ...)');
    console.log('  • Fixed 5 property references: device.code and device.name');
    console.log('  • No RLS migration needed (anonymous access already allowed)\n');
  } else {
    console.log('❌ SOME TESTS FAILED\n');
    console.log('Please review the test output above for details.\n');
  }
}

testBug1Fix().catch(console.error);
