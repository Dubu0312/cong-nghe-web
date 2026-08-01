"use strict";

const { body } = require("express-validator");

// Validation luôn chạy ở server. Thuộc tính required/minlength trên HTML chỉ
// để trải nghiệm tốt hơn, không thể tin được vì client có thể gửi thẳng request.

const registerRules = [
  body("full_name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Họ tên phải từ 2 đến 100 ký tự"),

  body("email")
    .trim()
    .isEmail()
    .withMessage("Email không hợp lệ")
    .normalizeEmail({ gmail_remove_dots: false }),

  body("password")
    .isLength({ min: 8 })
    .withMessage("Mật khẩu phải có ít nhất 8 ký tự"),

  body("confirm_password")
    .custom((value, { req }) => value === req.body.password)
    .withMessage("Mật khẩu xác nhận không khớp"),
];

const loginRules = [
  body("email").trim().notEmpty().withMessage("Vui lòng nhập email"),
  body("password").notEmpty().withMessage("Vui lòng nhập mật khẩu"),
];

module.exports = { registerRules, loginRules };
