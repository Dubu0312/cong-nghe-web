"use strict";

/** Người đã đăng nhập không cần mở lại trang đăng nhập/đăng ký. */
function guestOnly(req, res, next) {
  if (req.session.userId) return res.redirect("/notes");
  return next();
}

module.exports = { guestOnly };
