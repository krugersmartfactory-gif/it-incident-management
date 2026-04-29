// Script to check unrated incidents in database
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vjudueltlidywypsktwk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqdWR1ZWx0bGlkeXd5cHNrdHdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMDk5ODgsImV4cCI6MjA5MjU4NTk4OH0.YcnG3XF-sbAQYMH8HreQ7N4wZjiFzxN1oConjR7tcJM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkUnratedIncidents() {
  console.log('=== Checking Unrated Incidents ===\n');
  
  // Query 1: Get all incidents with status = 'Closed'
  console.log('1. All Closed incidents:');
  const { data: closedIncidents, error: error1 } = await supabase
    .from('incidents')
    .select('incident_code, status, rating, resolve_date')
    .eq('status', 'Closed');
  
  if (error1) {
    console.error('Error:', error1);
  } else {
    console.log('Count:', closedIncidents.length);
    console.table(closedIncidents);
  }
  
  // Query 2: Get all incidents with rating = NULL
  console.log('\n2. All incidents with rating = NULL:');
  const { data: unratedIncidents, error: error2 } = await supabase
    .from('incidents')
    .select('incident_code, status, rating, resolve_date')
    .is('rating', null);
  
  if (error2) {
    console.error('Error:', error2);
  } else {
    console.log('Count:', unratedIncidents.length);
    console.table(unratedIncidents);
  }
  
  // Query 3: Get all incidents with status = 'Closed' AND rating = NULL
  console.log('\n3. Closed incidents with rating = NULL:');
  const { data: targetIncidents, error: error3 } = await supabase
    .from('incidents')
    .select('incident_code, status, rating, resolve_date')
    .eq('status', 'Closed')
    .is('rating', null);
  
  if (error3) {
    console.error('Error:', error3);
  } else {
    console.log('Count:', targetIncidents.length);
    console.table(targetIncidents);
  }
  
  // Query 4: Try with order by resolve_date
  console.log('\n4. Closed incidents with rating = NULL (ordered by resolve_date):');
  const { data: orderedIncidents, error: error4 } = await supabase
    .from('incidents')
    .select('incident_code, status, rating, resolve_date')
    .eq('status', 'Closed')
    .is('rating', null)
    .order('resolve_date', { ascending: false });
  
  if (error4) {
    console.error('Error:', error4);
    console.error('Error details:', JSON.stringify(error4, null, 2));
  } else {
    console.log('Count:', orderedIncidents.length);
    console.table(orderedIncidents);
  }
  
  // Query 5: Check if resolve_date column exists
  console.log('\n5. All incidents (check columns):');
  const { data: allIncidents, error: error5 } = await supabase
    .from('incidents')
    .select('*')
    .limit(1);
  
  if (error5) {
    console.error('Error:', error5);
  } else {
    if (allIncidents && allIncidents.length > 0) {
      console.log('Available columns:', Object.keys(allIncidents[0]));
    }
  }
}

checkUnratedIncidents().catch(console.error);
