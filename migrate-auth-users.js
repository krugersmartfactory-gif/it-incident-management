// Load env
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// ================= CONFIG =================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Debug (xong có thể xoá)
console.log("URL:", SUPABASE_URL);
console.log("KEY loaded:", SUPABASE_SERVICE_ROLE_KEY ? "YES" : "NO");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env");
  process.exit(1);
}

// ================= INIT =================
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// ================= MAIN =================
async function migrateAuthUsers() {
  console.log("🚀 Bắt đầu migration...\n");

  // Lấy user từ bảng users
  const { data: users, error } = await supabase
    .from('users')
    .select('*');

  if (error) {
    console.error("❌ Lỗi đọc users:", error.message);
    return;
  }

  console.log(`📊 Tổng users: ${users.length}`);

  for (const user of users) {
    console.log(`\n👤 ${user.email}`);

    try {
      // Lấy danh sách auth users
      const { data: authData, error: authError } =
        await supabase.auth.admin.listUsers();

      if (authError) {
        console.error("❌ Lỗi auth:", authError.message);
        continue;
      }

      const existed = authData.users.find(u => u.email === user.email);

      if (existed) {
        console.log("⚠️ Đã tồn tại → bỏ qua");
        continue;
      }

      // Tạo user mới
      const { data: newUser, error: createError } =
        await supabase.auth.admin.createUser({
          email: user.email,
          password: "123456",
          email_confirm: true
        });

      if (createError) {
        console.error("❌ Tạo user lỗi:", createError.message);
        continue;
      }

      console.log("✅ Đã tạo user:", newUser.user.email);

    } catch (err) {
      console.error("❌ Lỗi:", err.message);
    }
  }

  console.log("\n🎉 DONE MIGRATION");
}

// Run
migrateAuthUsers();