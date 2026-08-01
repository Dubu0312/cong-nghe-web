"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");
const env = require("../config/env");
const { applySchema } = require("./schema");

// Tạo sẵn thư mục chứa file database (bỏ qua khi chạy test với :memory:).
if (env.databasePath !== ":memory:") {
  fs.mkdirSync(path.dirname(path.resolve(env.databasePath)), { recursive: true });
}

const db = new Database(env.databasePath);

// WAL cho phép đọc và ghi đồng thời, giảm lỗi "database is locked".
if (env.databasePath !== ":memory:") {
  db.pragma("journal_mode = WAL");
}
db.pragma("foreign_keys = ON");

// Tạo bảng ngay tại đây, trước khi bất kỳ repository hay session store nào kịp
// chuẩn bị câu lệnh. Nếu để việc này cho server.js thì lần deploy đầu tiên
// (database rỗng) sẽ hỏng, vì require("./app") chạy trước initDatabase().
applySchema(db);

module.exports = db;
