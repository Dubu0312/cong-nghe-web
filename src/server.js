"use strict";

const os = require("node:os");
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

  const { accounts } = await seedDemoData();
  if (accounts.primary.created) console.log(`Đã tạo tài khoản demo: ${env.demoEmail}`);
  if (accounts.second.created) console.log(`Đã tạo tài khoản demo: ${env.demo2Email}`);

  app.listen(env.port, env.host, () => {
    console.log(`Server đang chạy trên ${env.host}:${env.port}`);
    for (const url of reachableUrls()) {
      console.log(`  ${url}`);
    }
  });
}

/** Liệt kê các URL vào được, để khỏi phải tự tra IP khi test trên điện thoại. */
function reachableUrls() {
  const urls = [`http://localhost:${env.port}`];

  // Chỉ liệt kê IP khác khi thực sự nghe trên mọi interface.
  if (env.host !== "0.0.0.0") return urls;

  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === "IPv4" && !address.internal) {
        urls.push(`http://${address.address}:${env.port}`);
      }
    }
  }
  return urls;
}

start().catch((error) => {
  console.error("Không khởi động được server:", error);
  process.exit(1);
});
