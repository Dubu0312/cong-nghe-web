"use strict";

const noteRepository = require("../repositories/note.repository");
const { normalize, buildSearchText } = require("../utils/normalize");
const { notFound } = require("../utils/app-error");
const {
  CATEGORY_VALUES,
  SORT_ORDER_BY,
  DEFAULT_SORT,
  PAGE_SIZE,
} = require("../utils/constants");

/**
 * Làm sạch query string trước khi đụng tới database.
 * Mọi giá trị đều được whitelist hoặc ép kiểu, không tin dữ liệu từ URL.
 */
function parseListQuery(query = {}) {
  const q = String(query.q ?? "").trim().slice(0, 100);

  const category = CATEGORY_VALUES.includes(query.category) ? query.category : "";
  const sort = Object.hasOwn(SORT_ORDER_BY, query.sort) ? query.sort : DEFAULT_SORT;
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);

  return { q, category, sort, page };
}

function listNotes(userId, query) {
  const { q, category, sort, page: requestedPage } = parseListQuery(query);
  const searchTerm = q ? normalize(q) : "";

  const totalItems = noteRepository.countByUser({ userId, category, searchTerm });
  const totalPages = Math.max(Math.ceil(totalItems / PAGE_SIZE), 1);

  // Kẹp page vào khoảng hợp lệ: ?page=999 hiển thị trang cuối thay vì danh
  // sách rỗng khó hiểu.
  const page = Math.min(requestedPage, totalPages);

  const notes = noteRepository.findAllByUser({
    userId,
    category,
    searchTerm,
    sort,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return {
    notes,
    filters: { q, category, sort },
    pagination: { page, totalPages, totalItems, pageSize: PAGE_SIZE },
  };
}

/** Lấy chi tiết, ném 404 nếu không tồn tại hoặc không thuộc người dùng này. */
function getNoteOrFail(id, userId) {
  const note = noteRepository.findByIdForUser(id, userId);
  if (!note) throw notFound();
  return note;
}

function createNote(userId, { title, content, category, isPinned }) {
  return noteRepository.create({
    userId,
    title,
    content,
    category,
    searchText: buildSearchText(title, content),
    isPinned: isPinned ? 1 : 0,
  });
}

function updateNote(id, userId, { title, content, category, isPinned }) {
  const changes = noteRepository.update(id, userId, {
    title,
    content,
    category,
    searchText: buildSearchText(title, content),
    isPinned: isPinned ? 1 : 0,
  });

  // changes = 0 nghĩa là ghi chú không tồn tại hoặc thuộc người khác.
  // Trả 404 chứ không 403, để không tiết lộ ghi chú đó có thật hay không.
  if (changes === 0) throw notFound();
}

function deleteNote(id, userId) {
  if (noteRepository.remove(id, userId) === 0) throw notFound();
}

module.exports = {
  parseListQuery,
  listNotes,
  getNoteOrFail,
  createNote,
  updateNote,
  deleteNote,
};
