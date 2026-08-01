"use strict";

const db = require("../database/db");

// Tất cả truy vấn đều dùng tham số (?), không nối chuỗi với dữ liệu người dùng.

/**
 * Định danh người dùng luôn là email viết thường.
 *
 * Chuẩn hóa ngay tại đây thay vì bắt từng nơi gọi tự nhớ: trước đó seed so
 * sánh giá trị thô trong .env với giá trị đã viết thường trong database, nên
 * tài khoản demo có chữ hoa làm server crash ở lần khởi động thứ hai.
 */
function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function findByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(normalizeEmail(email));
}

function findById(id) {
  return db
    .prepare("SELECT id, full_name, email, created_at FROM users WHERE id = ?")
    .get(id);
}

function create({ fullName, email, passwordHash }) {
  const result = db
    .prepare(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES (?, ?, ?)`
    )
    .run(fullName, normalizeEmail(email), passwordHash);
  return findById(result.lastInsertRowid);
}

module.exports = { normalizeEmail, findByEmail, findById, create };
