"use strict";

const bcrypt = require("bcrypt");
const env = require("../config/env");
const userRepository = require("../repositories/user.repository");
const { AppError } = require("../utils/app-error");

// Hash thật của một chuỗi không ai đoán được, dùng làm mồi khi email không
// tồn tại. Mục đích là để bcrypt vẫn chạy đủ lâu, tránh việc kẻ tấn công đo
// thời gian phản hồi để dò xem email nào đã đăng ký.
const DUMMY_HASH =
  "$2b$12$VJJmVJIZB2lU..INDr.vc..YrHcO79xmejJa5Ck3MioGxBdeQZlhS";

/** Email luôn lưu ở dạng chữ thường để so sánh và kiểm tra trùng nhất quán. */
function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

async function register({ fullName, email, password }) {
  const normalizedEmail = normalizeEmail(email);

  if (userRepository.findByEmail(normalizedEmail)) {
    throw new AppError("Email đã được sử dụng", 409, "EMAIL_TAKEN");
  }

  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  return userRepository.create({
    fullName: String(fullName).trim(),
    email: normalizedEmail,
    passwordHash,
  });
}

/**
 * Trả về user nếu đúng thông tin, ngược lại trả null.
 * Không phân biệt "email không tồn tại" và "sai mật khẩu" để tránh lộ việc
 * một email có đăng ký hay chưa.
 */
async function verifyCredentials(email, password) {
  const user = userRepository.findByEmail(normalizeEmail(email));
  if (!user) {
    await bcrypt.compare(String(password), DUMMY_HASH);
    return null;
  }

  const matched = await bcrypt.compare(String(password), user.password_hash);
  if (!matched) return null;

  return { id: user.id, email: user.email, fullName: user.full_name };
}

module.exports = { register, verifyCredentials, normalizeEmail };
