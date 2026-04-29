// Script to create test incidents for rating
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vjudueltlidywypsktwk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqdWR1ZWx0bGlkeXd5cHNrdHdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMDk5ODgsImV4cCI6MjA5MjU4NTk4OH0.YcnG3XF-sbAQYMH8HreQ7N4wZjiFzxN1oConjR7tcJM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function createTestIncidents() {
  console.log('=== Creating Test Incidents ===\n');
  
  // Create 2 test incidents
  const testIncidents = [
    {
      incident_code: 'INC-2026-TEST01',
      incident_date: new Date().toISOString(),
      user_name: 'Lê Văn Dượm',
      department: 'IT',
      device_code: 'TN141',
      device_name: 'lap top Dell Inspiron 16 5640',
      description: 'Test incident 1 - Chưa đánh giá',
      severity: 'Cao',
      status: 'Closed',
      resolver: 'IT Support',
      resolution: 'Đã xử lý xong',
      root_cause: 'Test root cause',
      resolve_date: new Date().toISOString(),
      rating: null,
      rater_name: null,
      attitude_comment: null
    },
    {
      incident_code: 'INC-2026-TEST02',
      incident_date: new Date().toISOString(),
      user_name: 'Lê Văn Dượm',
      department: 'IT',
      device_code: 'TEST',
      device_name: 'Test Device',
      description: 'Test incident 2 - Chưa đánh giá',
      severity: 'Trung bình',
      status: 'Closed',
      resolver: 'IT Support',
      resolution: 'Đã xử lý xong',
      root_cause: 'Test root cause',
      resolve_date: new Date().toISOString(),
      rating: null,
      rater_name: null,
      attitude_comment: null
    }
  ];
  
  for (const incident of testIncidents) {
    console.log(`Creating incident: ${incident.incident_code}`);
    
    const { data, error } = await supabase
      .from('incidents')
      .insert(incident)
      .select();
    
    if (error) {
      console.error(`Error creating ${incident.incident_code}:`, error);
    } else {
      console.log(`✅ Created ${incident.incident_code}`);
    }
  }
  
  // Verify
  console.log('\n=== Verifying Created Incidents ===\n');
  const { data: unratedIncidents, error } = await supabase
    .from('incidents')
    .select('incident_code, status, rating, resolve_date')
    .eq('status', 'Closed')
    .is('rating', null);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Unrated incidents count:', unratedIncidents.length);
    console.table(unratedIncidents);
  }
}

createTestIncidents().catch(console.error);
