"use strict";

const { formatDateTime, excerpt } = require("../utils/format");
const { CATEGORIES, CATEGORY_LABELS, SORT_OPTIONS } = require("../utils/constants");
const { EXAMPLES } = require("../services/chat.service");
const env = require("../config/env");
const { assetUrl } = require("../utils/asset");

/**
 * Gán sẵn những giá trị mà hầu hết view đều cần, để controller không phải
 * truyền lặp đi lặp lại.
 */
function locals(req, res, next) {
  res.locals.currentUser = req.session.userId
    ? {
        id: req.session.userId,
        email: req.session.email,
        displayName: req.session.displayName,
      }
    : null;

  // Flash chỉ hiển thị một lần: đọc xong là xóa khỏi session ngay.
  res.locals.flash = req.session.flash || null;
  if (req.session.flash) delete req.session.flash;

  res.locals.formatDateTime = formatDateTime;
  res.locals.excerpt = excerpt;
  res.locals.categories = CATEGORIES;
  res.locals.categoryLabels = CATEGORY_LABELS;
  res.locals.sortOptions = SORT_OPTIONS;
  res.locals.currentPath = req.path;
  res.locals.asset = assetUrl;

  // Không có API key thì ẩn hẳn nút chat.
  res.locals.chatEnabled = Boolean(env.openaiApiKey);
  res.locals.chatExamples = EXAMPLES;

  next();
}

/** Ghi flash message, hiển thị ở request kế tiếp. */
function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

module.exports = { locals, setFlash };
