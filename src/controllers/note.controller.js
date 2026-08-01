"use strict";

const noteService = require("../services/note.service");
const { setFlash } = require("../middleware/locals");
const { asyncHandler } = require("../utils/async-handler");
const { notFound } = require("../utils/app-error");

/**
 * ID phải là số nguyên dương. Giá trị như "abc", "-1", "1.5" đều trả 404 thay
 * vì 400: chỉ một đường xử lý duy nhất và không tiết lộ thông tin gì thêm.
 */
function parseId(rawId) {
  if (!/^\d+$/.test(String(rawId))) throw notFound();
  const id = Number.parseInt(rawId, 10);
  if (id <= 0) throw notFound();
  return id;
}

/** Đọc dữ liệu form thành object thống nhất cho cả tạo mới và cập nhật. */
function readNoteForm(body) {
  return {
    title: String(body.title ?? "").trim(),
    content: String(body.content ?? "").trim(),
    category: body.category,
    isPinned: Boolean(body.is_pinned),
  };
}

const index = (req, res) => {
  const result = noteService.listNotes(req.session.userId, req.query);

  res.render("notes/index", {
    notes: result.notes,
    filters: result.filters,
    pagination: result.pagination,
    // Cờ này giúp view phân biệt "chưa có ghi chú nào" với "lọc không ra kết quả".
    hasFilters: Boolean(result.filters.q || result.filters.category),
  });
};

const showCreateForm = (req, res) => {
  res.render("notes/form", {
    mode: "create",
    note: null,
    errors: {},
    values: { category: "personal" },
  });
};

const create = (req, res) => {
  // user_id lấy từ session, không bao giờ lấy từ form.
  const note = noteService.createNote(req.session.userId, readNoteForm(req.body));

  setFlash(req, "success", "Tạo ghi chú thành công.");
  res.redirect(`/notes/${note.id}`);
};

const show = (req, res) => {
  const note = noteService.getNoteOrFail(parseId(req.params.id), req.session.userId);
  res.render("notes/detail", { note });
};

const showEditForm = (req, res) => {
  const note = noteService.getNoteOrFail(parseId(req.params.id), req.session.userId);

  res.render("notes/form", {
    mode: "edit",
    note,
    errors: {},
    values: {
      title: note.title,
      content: note.content,
      category: note.category,
      is_pinned: note.is_pinned === 1,
    },
  });
};

const update = (req, res) => {
  const id = parseId(req.params.id);
  noteService.updateNote(id, req.session.userId, readNoteForm(req.body));

  setFlash(req, "success", "Cập nhật ghi chú thành công.");
  res.redirect(`/notes/${id}`);
};

const remove = (req, res) => {
  noteService.deleteNote(parseId(req.params.id), req.session.userId);

  setFlash(req, "success", "Đã xóa ghi chú.");
  res.redirect("/notes");
};

module.exports = {
  parseId,
  index,
  showCreateForm,
  create,
  show,
  showEditForm,
  update,
  remove,
};
