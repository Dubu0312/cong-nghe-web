"use strict";

const session = require("express-session");
const env = require("./env");
const { SqliteSessionStore } = require("./session-store");

const store = new SqliteSessionStore();

// Dọn session hết hạn mỗi giờ. unref() để timer không giữ tiến trình sống,
// nhờ vậy Jest kết thúc được sau khi test xong.
const purgeTimer = setInterval(() => store.purgeExpired(), 60 * 60 * 1000);
if (typeof purgeTimer.unref === "function") purgeTimer.unref();

const sessionMiddleware = session({
  name: "note.sid",
  secret: env.sessionSecret,
  store,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true, // JavaScript phía client không đọc được cookie
    sameSite: "lax", // chặn cookie ở request POST từ site khác
    secure: env.isProduction, // chỉ gửi qua HTTPS khi chạy production
    maxAge: 1000 * 60 * 60 * 8,
  },
});

module.exports = { sessionMiddleware, store };
