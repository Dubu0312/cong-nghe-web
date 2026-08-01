"use strict";

// Danh mục hợp lệ. Dùng chung cho validator, repository và view.
const CATEGORIES = [
  { value: "personal", label: "Cá nhân" },
  { value: "study", label: "Học tập" },
  { value: "work", label: "Công việc" },
  { value: "idea", label: "Ý tưởng" },
  { value: "other", label: "Khác" },
];

const CATEGORY_VALUES = CATEGORIES.map((c) => c.value);

const CATEGORY_LABELS = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label])
);

// Whitelist sắp xếp: giá trị người dùng gửi lên chỉ dùng làm khóa tra bảng,
// không bao giờ được nối vào chuỗi SQL.
const SORT_OPTIONS = [
  { value: "updated_desc", label: "Mới cập nhật nhất", orderBy: "updated_at DESC" },
  { value: "updated_asc", label: "Cũ cập nhật nhất", orderBy: "updated_at ASC" },
  { value: "created_desc", label: "Mới tạo nhất", orderBy: "created_at DESC" },
  { value: "title_asc", label: "Tiêu đề A-Z", orderBy: "title COLLATE NOCASE ASC" },
];

const SORT_ORDER_BY = Object.fromEntries(
  SORT_OPTIONS.map((s) => [s.value, s.orderBy])
);

const DEFAULT_SORT = "updated_desc";
const PAGE_SIZE = 10;

const TITLE_MAX = 150;
const CONTENT_MAX = 10000;

module.exports = {
  CATEGORIES,
  CATEGORY_VALUES,
  CATEGORY_LABELS,
  SORT_OPTIONS,
  SORT_ORDER_BY,
  DEFAULT_SORT,
  PAGE_SIZE,
  TITLE_MAX,
  CONTENT_MAX,
};
