"use strict";

const env = require("../config/env");

/**
 * Xử lý lỗi tập trung. Đặt cuối cùng trong app.js.
 *
 * Nguyên tắc: log đầy đủ ở server, nhưng chỉ trả cho trình duyệt thông báo
 * chung. Stack trace không bao giờ được gửi ra ngoài ở production.
 */
// eslint-disable-next-line no-unused-vars -- Express nhận diện error handler qua 4 tham số
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;

  if (statusCode >= 500) {
    // Lỗi hệ thống: ghi cả stack để còn debug.
    if (!env.isTest) {
      console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
      console.error(err.stack || err);
    }
  }

  // Nếu response đã bắt đầu gửi thì để Express xử lý mặc định.
  if (res.headersSent) return next(err);

  if (statusCode === 404) {
    return res.status(404).render("errors/404");
  }

  if (statusCode === 403) {
    return res.status(403).render("errors/403", {
      message: err.message || "Yêu cầu bị từ chối.",
    });
  }

  return res.status(500).render("errors/500");
}

module.exports = { errorHandler };
