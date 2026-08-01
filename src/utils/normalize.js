"use strict";

/**
 * Chuẩn hóa chuỗi để tìm kiếm: viết thường và bỏ dấu tiếng Việt.
 *
 * Lý do cần hàm này: SQLite chỉ xử lý hoa/thường cho ký tự ASCII, LOWER('Ọ')
 * vẫn trả về 'Ọ'. Nếu tìm trực tiếp trên title/content thì gõ "học" sẽ không
 * ra ghi chú viết "Học". Ta chuẩn hóa cả nội dung lẫn từ khóa bằng JavaScript
 * rồi mới so sánh, nhờ đó gõ không dấu cũng tìm được.
 *
 *   normalize("Học Web") === "hoc web"
 */
function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD") // tách ký tự gốc và dấu thành hai code point
    .replace(/[\u0300-\u036f]/g, "") // bỏ toàn bộ dấu thanh và dấu mũ
    .replace(/đ/g, "d"); // đ không tách được bằng NFD nên xử lý riêng
}

/** Ghép title + content thành giá trị lưu vào cột search_text. */
function buildSearchText(title, content) {
  return normalize(`${title} ${content}`);
}

module.exports = { normalize, buildSearchText };
