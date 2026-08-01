"use strict";

const { notFound } = require("../utils/app-error");

/** Đặt sau toàn bộ route: mọi URL không khớp đều thành lỗi 404. */
function notFoundHandler(req, res, next) {
  next(notFound());
}

module.exports = { notFoundHandler };
