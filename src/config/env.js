"use strict";

require("dotenv").config();

const isTest = process.env.NODE_ENV === "test";
const isProduction = process.env.NODE_ENV === "production";

// Test luôn chạy trên database trong RAM để không đụng vào data/app.db.
const databasePath = isTest
  ? ":memory:"
  : process.env.DATABASE_PATH || "./data/app.db";

if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error("Thiếu SESSION_SECRET trong môi trường production.");
}

module.exports = {
  isTest,
  isProduction,
  port: Number.parseInt(process.env.PORT, 10) || 3000,

  // 0.0.0.0 nghĩa là nghe trên mọi network interface, nhờ vậy máy khác trong
  // cùng mạng truy cập được — tiện khi kiểm tra giao diện trên điện thoại.
  // Đặt HOST=127.0.0.1 nếu chỉ muốn mở cho chính máy này.
  host: process.env.HOST || "0.0.0.0",
  sessionSecret: process.env.SESSION_SECRET || "dev-secret-khong-dung-cho-production",
  databasePath,
  // Hạ số vòng bcrypt khi chạy test cho nhanh. Đây chỉ là đánh đổi tốc độ khi
  // kiểm thử; môi trường thật vẫn dùng 12 vòng.
  bcryptRounds: isTest ? 4 : Number.parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  demoEmail: process.env.DEMO_EMAIL || "20242507M",
  demoPassword: process.env.DEMO_PASSWORD || "12345678",

  // Hỏi đáp bằng ngôn ngữ tự nhiên. Không có key thì tính năng tự tắt.
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-5.6-luna",

  // Tài khoản thứ hai, tồn tại để minh họa mỗi người chỉ thấy dữ liệu của
  // chính mình: đăng nhập bằng tài khoản này sẽ không thấy ghi chú nào của
  // tài khoản trên, và mở URL ghi chú của nhau đều nhận 404.
  demo2Email: process.env.DEMO2_EMAIL || "user_test",
  demo2Password: process.env.DEMO2_PASSWORD || "12345678",
};
