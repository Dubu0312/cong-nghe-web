"use strict";

const { body } = require("express-validator");
const { CATEGORY_VALUES, TITLE_MAX, CONTENT_MAX } = require("../utils/constants");

const noteRules = [
  body("title")
    .trim()
    .isLength({ min: 1, max: TITLE_MAX })
    .withMessage(`Tiêu đề là bắt buộc và không quá ${TITLE_MAX} ký tự`),

  body("content")
    .trim()
    .isLength({ min: 1, max: CONTENT_MAX })
    .withMessage(`Nội dung là bắt buộc và không quá ${CONTENT_MAX.toLocaleString("vi-VN")} ký tự`),

  body("category")
    .isIn(CATEGORY_VALUES)
    .withMessage("Danh mục không hợp lệ"),

  // Checkbox không được tích thì trình duyệt không gửi trường này, nên phải
  // chấp nhận cả trường hợp thiếu và quy về boolean.
  body("is_pinned").toBoolean(),
];

module.exports = { noteRules };
