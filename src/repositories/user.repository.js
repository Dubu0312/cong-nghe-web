"use strict";

const db = require("../database/db");

// Tất cả truy vấn đều dùng tham số (?), không nối chuỗi với dữ liệu người dùng.

function findByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
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
    .run(fullName, email, passwordHash);
  return findById(result.lastInsertRowid);
}

module.exports = { findByEmail, findById, create };
