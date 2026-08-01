"use strict";

const crypto = require("node:crypto");
const { AppError } = require("../utils/app-error");

/**
 * Bảo vệ CSRF bằng synchronizer token.
 *
 * Không dùng thư viện: `csurf` đã ngừng bảo trì, còn cơ chế thì chỉ gồm sinh
 * token lưu vào session, nhúng vào form và so lại khi nhận POST.
 *
 * Middleware này phải đứng sau body parser và session.
 */
function csrf(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  res.locals.csrfToken = req.session.csrfToken;

  if (req.method !== "POST") return next();

  const sent = req.body?._csrf;
  const expected = req.session.csrfToken;

  // timingSafeEqual ném lỗi nếu hai buffer khác độ dài, nên phải kiểm tra trước.
  const valid =
    typeof sent === "string" &&
    sent.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));

  if (!valid) {
    return next(
      new AppError("Phiên làm việc không hợp lệ, vui lòng thử lại.", 403, "CSRF")
    );
  }

  return next();
}

module.exports = { csrf };
