#!/usr/bin/env node

/**
 * Check Database State - Verify test data exists
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = 'https://vjudueltlidywypsktwk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqdWR1ZWx0bGlkeXd5cHNrdHdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMDk5ODgsImV4cCI6MjA5MjU4NTk4OH0.YcnG3XF-sbAQYMH8HreQ7N4wZjiFzxN1oConjR7tcJM';

const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkDatabase() {
  console.log('\n========================================');
  console.log('Database State Check');
  console.log('========================================\n');
  
  // Check devices table
  console.log('1. Checking devices table...');
  const { data: devices, error: devicesError } = await supabaseAnon
    .from('devices')
    .select('*')
    .limit(10);
  
  if (devicesError) {
    console.log(`   ❌ Error: ${devicesError.message}`);
    console.log(`   This confirms Bug 1: RLS policy blocks anonymous access\n`);
  } else {
    console.log(`   ✅ Query succeeded (${devices?.length || 0} devices found)`);
    if (devices && devices.length > 0) {
      console.log('   Sample devices:');
      devices.forEach(d => {
        console.log(`   - ${d.code}: ${d.name}`);
      });
    } else {
      console.log('   ⚠️  No devices found in database');
    }
    console.log('');
  }
  
  // Check incidents table
  console.log('2. Checking incidents table...');
  const { data: incidents, error: incidentsError } = await supabaseAnon
    .from('incidents')
    .select('*')
    .limit(10);
  
  if (incidentsError) {
    console.log(`   ❌ Error: ${incidentsError.message}\n`);
  } else {
    console.log(`   ✅ Query succeeded (${incidents?.length || 0} incidents found)`);
    if (incidents && incidents.length > 0) {
      console.log('   Sample incidents:');
      incidents.forEach(i => {
        console.log(`   - ${i.incident_code}: ${i.status}, rating: ${i.rating || 'null'}`);
      });
    } else {
      console.log('   ⚠️  No incidents found in database');
    }
    console.log('');
  }
  
  // Check unrated closed incidents
  console.log('3. Checking unrated closed incidents...');
  const { data: unrated, error: unratedError } = await supabaseAnon
    .from('incidents')
    .select('*')
    .eq('status', 'Closed')
    .is('rating', null);
  
  if (unratedError) {
    console.log(`   ❌ Error: ${unratedError.message}\n`);
  } else {
    console.log(`   ✅ Found ${unrated?.length || 0} unrated closed incidents`);
    if (unrated && unrated.length > 0) {
      unrated.forEach(i => {
        console.log(`   - ${i.incident_code}: ${i.device_code}`);
      });
    }
    console.log('');
  }
  
  console.log('========================================');
  console.log('Summary');
  console.log('========================================\n');
  
  if (devicesError) {
    console.log('✅ Bug 1 CONFIRMED: RLS policy blocks anonymous device access');
  } else if (!devices || devices.length === 0) {
    console.log('⚠️  Bug 1 CANNOT BE TESTED: No devices in database');
  } else {
    console.log('❌ Bug 1 NOT CONFIRMED: Anonymous access works (might be already fixed)');
  }
  
  if (!unrated || unrated.length === 0) {
    console.log('⚠️  Bug 3 CANNOT BE TESTED: No unrated closed incidents in database');
  } else {
    console.log('✅ Bug 3 CAN BE TESTED: Unrated incidents exist');
  }
  
  console.log('');
}

checkDatabase().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
