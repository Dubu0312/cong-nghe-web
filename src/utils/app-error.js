"use strict";

/**
 * Lỗi có kèm HTTP status. Controller/service ném lỗi này, errorHandler đọc
 * statusCode để render đúng trang thay vì mặc định 500.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const notFound = (message = "Không tìm thấy nội dung") =>
  new AppError(message, 404, "NOT_FOUND");

module.exports = { AppError, notFound };
