"use strict";

// SQLite lưu CURRENT_TIMESTAMP theo UTC. Nếu in thẳng ra view thì người dùng
// Việt Nam thấy lệch 7 tiếng, nên mọi chỗ hiển thị thời gian đều đi qua đây.
const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

function toDate(sqliteValue) {
  // SQLite trả "YYYY-MM-DD HH:MM:SS" không kèm timezone, thêm "Z" để Date
  // hiểu đây là UTC thay vì giờ máy chủ.
  return new Date(String(sqliteValue).replace(" ", "T") + "Z");
}

function formatDateTime(sqliteValue) {
  if (!sqliteValue) return "";
  return dateTimeFormatter.format(toDate(sqliteValue));
}

/** Cắt nội dung dài để hiển thị trên card danh sách. */
function excerpt(text, maxLength = 120) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength).trimEnd() + "…";
}

module.exports = { formatDateTime, excerpt };
