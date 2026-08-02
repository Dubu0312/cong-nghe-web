"use strict";

const express = require("express");
const controller = require("../controllers/note.controller");
const { noteRules } = require("../validators/note.validator");
const { handleValidation } = require("../middleware/validation");
const { requireAuth } = require("../middleware/require-auth");

const router = express.Router();

// Toàn bộ route ghi chú đều yêu cầu đăng nhập.
router.use(requireAuth);

router.get("/", controller.index);

// Đặt trước /:id để "chat" không bị hiểu nhầm là mã ghi chú.
router.post("/chat", controller.chat);

router.get("/new", controller.showCreateForm);
router.post(
  "/",
  noteRules,
  handleValidation("notes/form", () => ({ mode: "create", note: null })),
  controller.create
);

// Đặt sau /new để "new" không bị hiểu nhầm là một id.
router.get("/:id", controller.show);
router.get("/:id/edit", controller.showEditForm);

router.post(
  "/:id",
  noteRules,
  handleValidation("notes/form", (req) => ({
    mode: "edit",
    note: { id: controller.parseId(req.params.id) },
  })),
  controller.update
);

// Xóa dùng POST chứ không dùng GET, vì GET phải là thao tác không đổi trạng thái.
router.post("/:id/delete", controller.remove);

module.exports = router;
