// Supabase Configuration Example
// Copy file này thành config.js và điền thông tin Supabase của bạn

const SUPABASE_CONFIG = {
  url: 'YOUR_SUPABASE_URL',  // Ví dụ: https://xxxxx.supabase.co
  anonKey: 'YOUR_SUPABASE_ANON_KEY'  // Anon/Public key từ Supabase Dashboard
};

// Nếu dùng trong Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SUPABASE_CONFIG;
}
