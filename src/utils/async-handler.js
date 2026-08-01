"use strict";

/**
 * Bọc handler async để lỗi được chuyển sang errorHandler thay vì thành
 * unhandled rejection. Express 5 đã tự làm việc này, nhưng giữ lại để ý định
 * rõ ràng và không phụ thuộc hành vi ngầm của framework.
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
