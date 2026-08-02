"use strict";

const noteService = require("../services/note.service");
const chatService = require("../services/chat.service");
const env = require("../config/env");
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

/**
 * Trả lời câu hỏi bằng ngôn ngữ tự nhiên. Trả JSON vì khung chat gọi bằng fetch
 * chứ không nạp lại cả trang.
 */
const chat = asyncHandler(async (req, res) => {
  if (!env.openaiApiKey) {
    return res.status(503).json({ error: "Tính năng hỏi đáp chưa được bật." });
  }

  try {
    // userId lấy từ phiên đăng nhập, câu hỏi không can thiệp được vào giá trị này.
    const result = await chatService.ask(
      req.session.userId,
      req.body.question,
      req.body.history
    );
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

module.exports = {
  parseId,
  index,
  chat,
  showCreateForm,
  create,
  show,
  showEditForm,
  update,
  remove,
};
