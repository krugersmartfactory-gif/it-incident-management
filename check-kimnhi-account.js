// Check kimnhi@krugervn.com account
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vjudueltlidywypsktwk.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqdWR1ZWx0bGlkeXd5cHNrdHdrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAwOTk4OCwiZXhwIjoyMDkyNTg1OTg4fQ.s_3d-vHYB7Oe_Ks6_JVEKkPXzqELdJYJLqGPXqJqxnI';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkAccount() {
  console.log('🔍 Checking account: kimnhi@krugervn.com\n');
  
  // Check auth.users
  console.log('1️⃣ Checking auth.users...');
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error('❌ Error fetching auth users:', authError);
  } else {
    const kimNhiAuth = authUsers.users.find(u => u.email === 'kimnhi@krugervn.com');
    if (kimNhiAuth) {
      console.log('✅ Found in auth.users:');
      console.log('   - ID:', kimNhiAuth.id);
      console.log('   - Email:', kimNhiAuth.email);
      console.log('   - Email confirmed:', kimNhiAuth.email_confirmed_at ? 'YES' : 'NO');
      console.log('   - Created at:', kimNhiAuth.created_at);
    } else {
      console.log('❌ NOT found in auth.users');
    }
  }
  
  console.log('\n2️⃣ Checking public.users...');
  const { data: publicUsers, error: publicError } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'kimnhi@krugervn.com');
  
  if (publicError) {
    console.error('❌ Error fetching public users:', publicError);
  } else {
    if (publicUsers && publicUsers.length > 0) {
      const user = publicUsers[0];
      console.log('✅ Found in public.users:');
      console.log('   - ID:', user.id);
      console.log('   - Email:', user.email);
      console.log('   - Name:', user.name);
      console.log('   - Department:', user.department);
      console.log('   - Access role:', user.access_role);
      console.log('   - Form access:', user.form_access);
      console.log('   - Is locked:', user.is_locked);
      console.log('   - Is admin:', user.is_admin);
    } else {
      console.log('❌ NOT found in public.users');
    }
  }
  
  console.log('\n3️⃣ Checking login_attempts...');
  const { data: attempts, error: attemptsError } = await supabase
    .from('login_attempts')
    .select('*')
    .eq('email', 'kimnhi@krugervn.com')
    .order('attempt_time', { ascending: false })
    .limit(5);
  
  if (attemptsError) {
    console.error('❌ Error fetching login attempts:', attemptsError);
  } else {
    if (attempts && attempts.length > 0) {
      console.log(`⚠️ Found ${attempts.length} failed login attempts:`);
      attempts.forEach((attempt, idx) => {
        console.log(`   ${idx + 1}. ${new Date(attempt.attempt_time).toLocaleString('vi-VN')}`);
      });
    } else {
      console.log('✅ No failed login attempts');
    }
  }
}

checkAccount().catch(console.error);
