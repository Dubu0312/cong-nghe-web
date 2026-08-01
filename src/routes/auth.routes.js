"use strict";

const express = require("express");
const controller = require("../controllers/auth.controller");
const { registerRules, loginRules } = require("../validators/auth.validator");
const { handleValidation } = require("../middleware/validation");
const { guestOnly } = require("../middleware/guest-only");
const { requireAuth } = require("../middleware/require-auth");

const router = express.Router();

router.get("/register", guestOnly, controller.showRegister);
router.post(
  "/register",
  guestOnly,
  registerRules,
  handleValidation("auth/register"),
  controller.register
);

router.get("/login", guestOnly, controller.showLogin);
router.post(
  "/login",
  guestOnly,
  loginRules,
  handleValidation("auth/login"),
  controller.login
);

// Đăng xuất là thao tác đổi trạng thái nên bắt buộc dùng POST, không dùng link GET.
router.post("/logout", requireAuth, controller.logout);

module.exports = router;
