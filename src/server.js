"use strict";

const app = require("./app");
const env = require("./config/env");
const { initDatabase } = require("./database/init");
const { seedDemoData } = require("./database/seed");

/**
 * Khởi tạo schema và seed ngay khi server chạy.
 *
 * Lý do: các nền tảng miễn phí không có ổ đĩa lưu trữ lâu dài ở gói free, file
 * SQLite sẽ bị xóa sau mỗi lần deploy hoặc khi instance khởi động lại. Vì cả
 * initDatabase lẫn seedDemoData đều idempotent nên gọi mỗi lần boot là an toàn,
 * và tài khoản demo luôn tồn tại khi giảng viên vào chấm.
 */
async function start() {
  initDatabase();

  const result = await seedDemoData();
  if (result.created) {
    console.log(`Đã tạo tài khoản demo: ${env.demoEmail}`);
  }

  app.listen(env.port, () => {
    console.log(`Server đang chạy tại http://localhost:${env.port}`);
  });
}

start().catch((error) => {
  console.error("Không khởi động được server:", error);
  process.exit(1);
});
