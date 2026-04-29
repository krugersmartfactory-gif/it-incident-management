#!/usr/bin/env node

/**
 * Bug Condition Exploration Tests - Node.js Runner
 * 
 * This script tests Bug 1 and Bug 3 programmatically.
 * Bug 2 requires browser DOM manipulation and must be tested manually.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase configuration
const SUPABASE_URL = 'https://vjudueltlidywypsktwk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqdWR1ZWx0bGlkeXd5cHNrdHdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMDk5ODgsImV4cCI6MjA5MjU4NTk4OH0.YcnG3XF-sbAQYMH8HreQ7N4wZjiFzxN1oConjR7tcJM';

// Initialize Supabase client with ONLY anon key (no auth session)
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test results storage
const testResults = {
  bug1: null,
  bug3: null
};

// ========================================
// BUG 1: RLS POLICY BLOCKS ANONYMOUS ACCESS
// ========================================
async function testBug1_AnonymousDeviceAccess() {
  console.log('\n========================================');
  console.log('Bug 1: RLS Policy Blocks Anonymous Device Access');
  console.log('========================================\n');
  
  const deviceCode = 'TN141';
  
  console.log(`Testing anonymous device query for device code: ${deviceCode}`);
  console.log('Expected: Query should FAIL with RLS policy error (bug confirmed)\n');
  
  try {
    // CRITICAL: This query uses ONLY the anon key (no auth session)
    // On unfixed code, this should FAIL with RLS policy error
    const { data, error } = await supabaseAnon
      .from('devices')
      .select('*')
      .eq('code', deviceCode)  // ✅ Use 'code' column (not 'device_code')
      .maybeSingle();
    
    if (error) {
      // EXPECTED OUTCOME: Query fails with RLS policy error
      const counterexample = {
        deviceCode: deviceCode,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        timestamp: new Date().toISOString()
      };
      
      testResults.bug1 = { passed: false, counterexample };
      
      console.log('✅ TEST RESULT: EXPECTED FAILURE (Bug Confirmed)\n');
      console.log('📋 Counterexample - Bug 1:');
      console.log(`   Device Code: ${counterexample.deviceCode}`);
      console.log(`   Error Message: ${counterexample.errorMessage}`);
      console.log(`   Error Code: ${counterexample.errorCode || 'N/A'}`);
      console.log(`   Error Details: ${counterexample.errorDetails || 'N/A'}`);
      console.log(`   Timestamp: ${counterexample.timestamp}`);
      console.log('\n🔍 Analysis:');
      console.log('   The RLS policy blocks anonymous users from querying the devices table.');
      console.log('   This confirms Bug 1 exists.');
      console.log('   Expected behavior after fix: Anonymous users should be able to query devices table successfully.\n');
      
      return true; // Test passed (expected failure)
    } else {
      // UNEXPECTED: Query succeeded (bug might already be fixed)
      testResults.bug1 = { passed: true, data };
      
      console.log('⚠️  TEST RESULT: UNEXPECTED PASS\n');
      console.log('The anonymous device query succeeded. This suggests:');
      console.log('1. Bug 1 might already be fixed, OR');
      console.log('2. The RLS policy is not properly configured\n');
      console.log('Query Result:');
      console.log(JSON.stringify(data, null, 2));
      console.log('');
      
      return false; // Test failed (unexpected pass)
    }
  } catch (error) {
    // Unexpected error (not RLS policy error)
    testResults.bug1 = { passed: false, error: error.message };
    
    console.log('❌ TEST ERROR: Unexpected error occurred\n');
    console.log(error.message);
    console.log('');
    
    return false;
  }
}

// ========================================
// BUG 3: WRONG STATUS FILTER
// ========================================
async function testBug3_StatusFilter() {
  console.log('\n========================================');
  console.log('Bug 3: Wrong Status Filter in Rate Tab');
  console.log('========================================\n');
  
  console.log('Testing status filter query...');
  console.log('Expected: Buggy query (status = "Đã xử lý") should return 0 results');
  console.log('          Correct query (status = "Closed") should return > 0 results\n');
  
  try {
    // First, check how many incidents exist with status = 'Closed' AND rating IS NULL
    const { data: correctQuery, error: correctError, count: correctCount } = await supabaseAnon
      .from('incidents')
      .select('*', { count: 'exact' })
      .eq('status', 'Closed')
      .is('rating', null);
    
    if (correctError) throw correctError;
    
    // Now, test the BUGGY query (what the unfixed code does)
    const { data: buggyQuery, error: buggyError, count: buggyCount } = await supabaseAnon
      .from('incidents')
      .select('*', { count: 'exact' })
      .eq('status', 'Đã xử lý')  // ❌ Wrong status value (Vietnamese instead of English)
      .is('rating', null);
    
    if (buggyError) throw buggyError;
    
    const correctResultCount = correctQuery?.length || 0;
    const buggyResultCount = buggyQuery?.length || 0;
    
    const counterexample = {
      correctStatusValue: 'Closed',
      buggyStatusValue: 'Đã xử lý',
      correctQueryCount: correctResultCount,
      buggyQueryCount: buggyResultCount,
      discrepancy: correctResultCount - buggyResultCount,
      timestamp: new Date().toISOString()
    };
    
    if (buggyResultCount === 0 && correctResultCount > 0) {
      // EXPECTED OUTCOME: Buggy query returns 0, correct query returns > 0
      testResults.bug3 = { passed: false, counterexample };
      
      console.log('✅ TEST RESULT: EXPECTED FAILURE (Bug Confirmed)\n');
      console.log('📋 Counterexample - Bug 3:');
      console.log(`   Correct Status Value: '${counterexample.correctStatusValue}'`);
      console.log(`   Buggy Status Value: '${counterexample.buggyStatusValue}'`);
      console.log(`   Correct Query Result: ${counterexample.correctQueryCount} incidents`);
      console.log(`   Buggy Query Result: ${counterexample.buggyQueryCount} incidents`);
      console.log(`   Discrepancy: ${counterexample.discrepancy} incidents missing`);
      console.log(`   Timestamp: ${counterexample.timestamp}`);
      console.log('\n🔍 Analysis:');
      console.log(`   The query with status = 'Đã xử lý' returns 0 results, but the correct query`);
      console.log(`   with status = 'Closed' returns ${correctResultCount} incidents. This confirms Bug 3 exists.`);
      console.log('   Expected behavior after fix: Query should use status = "Closed" to match database schema.\n');
      
      return true; // Test passed (expected failure)
    } else if (buggyResultCount === correctResultCount) {
      // UNEXPECTED: Both queries return the same count (bug might already be fixed)
      testResults.bug3 = { passed: true, counterexample };
      
      console.log('⚠️  TEST RESULT: UNEXPECTED PASS\n');
      console.log(`Both queries return the same count (${correctResultCount} incidents). This suggests:`);
      console.log('1. Bug 3 might already be fixed, OR');
      console.log('2. The database has incidents with status = "Đã xử lý" (Vietnamese), OR');
      console.log('3. There are no unrated incidents in the database\n');
      console.log(`Correct Query (status = 'Closed'): ${correctResultCount} incidents`);
      console.log(`Buggy Query (status = 'Đã xử lý'): ${buggyResultCount} incidents\n`);
      
      return false; // Test failed (unexpected pass)
    } else {
      // Partial match (some incidents found but not all)
      testResults.bug3 = { passed: false, counterexample };
      
      console.log('✅ TEST RESULT: EXPECTED FAILURE (Bug Confirmed)\n');
      console.log('📋 Counterexample - Bug 3:');
      console.log(`   Correct Query (status = 'Closed'): ${correctResultCount} incidents`);
      console.log(`   Buggy Query (status = 'Đã xử lý'): ${buggyResultCount} incidents`);
      console.log(`   Missing Incidents: ${correctResultCount - buggyResultCount} incidents`);
      console.log('\n🔍 Analysis:');
      console.log('   The buggy query returns fewer incidents than the correct query.');
      console.log('   This confirms Bug 3 exists.\n');
      
      return true; // Test passed (expected failure)
    }
  } catch (error) {
    testResults.bug3 = { passed: false, error: error.message };
    
    console.log('❌ TEST ERROR: Unexpected error occurred\n');
    console.log(error.message);
    console.log('');
    
    return false;
  }
}

// ========================================
// MAIN TEST RUNNER
// ========================================
async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Bug Condition Exploration Tests - Device Info Page Bugs  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n⚠️  CRITICAL: These tests are designed to FAIL on unfixed code.');
  console.log('   Test failures confirm the bugs exist.');
  console.log('   DO NOT attempt to fix the tests or code when they fail.\n');
  
  const results = [];
  
  // Run Bug 1 test
  const bug1Result = await testBug1_AnonymousDeviceAccess();
  results.push({ name: 'Bug 1: RLS Policy', passed: bug1Result });
  
  // Run Bug 3 test
  const bug3Result = await testBug3_StatusFilter();
  results.push({ name: 'Bug 3: Status Filter', passed: bug3Result });
  
  // Print summary
  console.log('\n========================================');
  console.log('Test Summary');
  console.log('========================================\n');
  
  results.forEach(result => {
    const status = result.passed ? '✅ Expected Fail (Bug Confirmed)' : '⚠️  Unexpected Pass or Error';
    console.log(`${result.name}: ${status}`);
  });
  
  console.log('\n📝 Note: Bug 2 (Scroll Position) requires browser DOM manipulation');
  console.log('   and must be tested manually using test-device-info-bugs.html\n');
  
  const expectedFails = results.filter(r => r.passed).length;
  const totalTests = results.length;
  
  console.log(`Tests Run: ${totalTests}`);
  console.log(`Expected Failures (Bugs Confirmed): ${expectedFails}\n`);
  
  if (expectedFails === totalTests) {
    console.log('✅ All tests failed as expected - bugs confirmed!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests passed unexpectedly - investigate further.\n');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
