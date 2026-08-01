"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SCHEMA_PATH = path.join(__dirname, "schema.sql");

/**
 * Tạo bảng và index nếu chưa có.
 *
 * Mọi câu lệnh đều dùng IF NOT EXISTS nên gọi bao nhiêu lần cũng an toàn.
 * Hàm này được gọi ngay khi mở kết nối (xem db.js) để không module nào có thể
 * truy vấn vào một database chưa có bảng — trường hợp xảy ra khi deploy lần
 * đầu trên máy chủ chưa có file database.
 */
function applySchema(db) {
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
}

module.exports = { applySchema };
