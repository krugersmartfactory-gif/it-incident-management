// Supabase Configuration
// File này chứa thông tin kết nối Supabase
const SUPABASE_CONFIG = {
  url: 'https://vjudueltlidywypsktwk.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqdWR1ZWx0bGlkeXd5cHNrdHdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMDk5ODgsImV4cCI6MjA5MjU4NTk4OH0.YcnG3XF-sbAQYMH8HreQ7N4wZjiFzxN1oConjR7tcJM'
};

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SUPABASE_CONFIG;
}
