"use strict";

const authService = require("../services/auth.service");
const { setFlash } = require("../middleware/locals");
const { asyncHandler } = require("../utils/async-handler");

const showRegister = (req, res) => {
  res.render("auth/register", { errors: {}, values: {} });
};

const register = asyncHandler(async (req, res) => {
  const { full_name: fullName, email, password } = req.body;

  try {
    await authService.register({ fullName, email, password });
  } catch (error) {
    if (error.code === "EMAIL_TAKEN") {
      // 409 Conflict, kèm form đã điền sẵn để người dùng sửa.
      return res.status(409).render("auth/register", {
        errors: { email: "Email đã được sử dụng" },
        values: req.body,
      });
    }
    throw error;
  }

  setFlash(req, "success", "Đăng ký thành công. Mời bạn đăng nhập.");
  return res.redirect("/auth/login");
});

const showLogin = (req, res) => {
  res.render("auth/login", { errors: {}, values: {} });
};

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await authService.verifyCredentials(email, password);

  if (!user) {
    // Thông báo chung, không nói rõ email có tồn tại hay không.
    return res.status(401).render("auth/login", {
      errors: { form: "Email hoặc mật khẩu không chính xác" },
      values: { email },
    });
  }

  // Đổi session ID sau khi đăng nhập để chống session fixation: nếu kẻ tấn
  // công đã cấy sẵn một session ID vào trình duyệt nạn nhân, ID đó trở nên vô dụng.
  await new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });

  req.session.userId = user.id;
  req.session.email = user.email;
  req.session.displayName = user.fullName;

  setFlash(req, "success", `Xin chào ${user.fullName}!`);
  return res.redirect("/notes");
});

const logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie("note.sid");
    return res.redirect("/auth/login");
  });
};

module.exports = { showRegister, register, showLogin, login, logout };
