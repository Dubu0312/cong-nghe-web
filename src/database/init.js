"use strict";

const db = require("./db");
const { applySchema } = require("./schema");

/**
 * Tạo bảng và index. Kết nối trong db.js đã tự chạy applySchema khi khởi tạo,
 * hàm này giữ lại để dùng cho script `npm run db:init` và để test gọi tường minh.
 */
function initDatabase() {
  applySchema(db);
}

module.exports = { initDatabase };

// Cho phép chạy độc lập: npm run db:init
if (require.main === module) {
  initDatabase();
  console.log("Đã khởi tạo database.");
}
