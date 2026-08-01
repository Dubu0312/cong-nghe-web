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
  sessionSecret: process.env.SESSION_SECRET || "dev-secret-khong-dung-cho-production",
  databasePath,
  // Hạ số vòng bcrypt khi chạy test cho nhanh. Đây chỉ là đánh đổi tốc độ khi
  // kiểm thử; môi trường thật vẫn dùng 12 vòng.
  bcryptRounds: isTest ? 4 : Number.parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  demoEmail: process.env.DEMO_EMAIL || "20242507M",
  demoPassword: process.env.DEMO_PASSWORD || "12345678",
};
