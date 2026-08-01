"use strict";

const { setFlash } = require("./locals");

/**
 * Chặn route quản lý khi chưa đăng nhập.
 *
 * Trả 302 về trang đăng nhập chứ không trả 401: đây là ứng dụng render HTML
 * phía server, người dùng cần nhìn thấy form đăng nhập chứ không phải một
 * trang lỗi. Mã 401 chỉ dùng khi sai thông tin ở POST /auth/login.
 */
function requireAuth(req, res, next) {
  if (req.session.userId) return next();

  setFlash(req, "warning", "Vui lòng đăng nhập để tiếp tục.");
  return res.redirect("/auth/login");
}

module.exports = { requireAuth };
