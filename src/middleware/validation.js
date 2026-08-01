"use strict";

const { validationResult } = require("express-validator");

/**
 * Gom lỗi validation thành object { tênTrường: thôngBáo } để view hiển thị
 * ngay dưới từng ô nhập.
 */
function collectErrors(req) {
  const result = validationResult(req);
  if (result.isEmpty()) return null;

  const errors = {};
  for (const error of result.array()) {
    // Chỉ giữ lỗi đầu tiên của mỗi trường, tránh hiển thị chồng chất.
    if (!errors[error.path]) errors[error.path] = error.msg;
  }
  return errors;
}

/**
 * Tạo middleware render lại form kèm lỗi và dữ liệu vừa nhập.
 * Trả 422 theo đúng quy ước status code của dự án.
 *
 * @param {string} view    đường dẫn view cần render lại
 * @param {Function} buildLocals  (req) => dữ liệu bổ sung cho view
 */
function handleValidation(view, buildLocals = () => ({})) {
  return function validate(req, res, next) {
    const errors = collectErrors(req);
    if (!errors) return next();

    return res.status(422).render(view, {
      errors,
      values: req.body, // giữ lại những gì người dùng đã gõ
      ...buildLocals(req),
    });
  };
}

module.exports = { collectErrors, handleValidation };
