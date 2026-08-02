"use strict";

const db = require("../database/db");
const env = require("../config/env");

/*
 * Hỏi đáp bằng ngôn ngữ tự nhiên trên dữ liệu ghi chú.
 *
 * Cách làm: gửi câu hỏi kèm mô tả bảng cho mô hình ngôn ngữ, nhận lại một câu
 * SELECT, chạy câu đó rồi trả kết quả về.
 *
 * Câu lệnh do mô hình sinh ra không được tin tuyệt đối nên trước khi chạy phải
 * đi qua vài kiểm tra ở hàm guardSql: chỉ cho SELECT, chỉ đụng bảng notes, và
 * bắt buộc kèm điều kiện user_id của người đang đăng nhập. Không có mấy dòng đó
 * thì bất kỳ ai cũng lấy được dữ liệu của người khác chỉ bằng cách hỏi khéo.
 */

const SCHEMA_HINT = `
Bảng notes:
  id          INTEGER
  user_id     INTEGER  -- chủ sở hữu ghi chú
  title       TEXT     -- tiêu đề
  content     TEXT     -- nội dung
  category    TEXT     -- một trong: personal, study, work, idea, other
  is_pinned   INTEGER  -- 1 nếu được ghim
  created_at  DATETIME
  updated_at  DATETIME
`.trim();

const SYSTEM_PROMPT = `
Bạn chuyển câu hỏi tiếng Việt thành MỘT câu lệnh SELECT của SQLite.

${SCHEMA_HINT}

Quy tắc bắt buộc:
- Chỉ trả về câu SQL, không giải thích, không bọc trong dấu nháy hay markdown.
- Chỉ dùng SELECT. Không INSERT, UPDATE, DELETE, DROP, ATTACH, PRAGMA.
- Chỉ truy vấn bảng notes. Không đụng tới bảng users hay sessions.
- Luôn có điều kiện: user_id = :userId
- Luôn kèm LIMIT tối đa 50.
- So sánh chuỗi thì dùng LIKE và bọc trong lower(...) cho không phân biệt hoa thường.
`.trim();

const FORBIDDEN = /\b(insert|update|delete|drop|alter|create|replace|attach|detach|pragma|vacuum|users|sessions)\b/i;

/**
 * Kiểm tra câu lệnh trước khi chạy. Ném lỗi nếu không đạt.
 * Trả về câu lệnh đã được dọn dẹp.
 */
function guardSql(sql) {
  let clean = String(sql || "")
    .replace(/```sql/gi, "")
    .replace(/```/g, "")
    .trim()
    .replace(/;+\s*$/, "");

  if (!clean) throw new Error("Mô hình không trả về câu lệnh nào.");
  if (clean.includes(";")) throw new Error("Chỉ chấp nhận một câu lệnh duy nhất.");
  if (!/^select\b/i.test(clean)) throw new Error("Chỉ chấp nhận câu lệnh SELECT.");
  if (FORBIDDEN.test(clean)) throw new Error("Câu lệnh chứa từ khóa không được phép.");
  if (!clean.includes(":userId")) throw new Error("Câu lệnh thiếu điều kiện user_id.");
  if (!/\blimit\b/i.test(clean)) clean += " LIMIT 50";

  return clean;
}

/** Gọi mô hình ngôn ngữ để sinh câu SQL. */
async function generateSql(question) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.openaiModel,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: question },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gọi mô hình thất bại (${res.status}): ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Trả lời một câu hỏi của người dùng.
 *
 * @param {number} userId  lấy từ phiên đăng nhập, không bao giờ từ câu hỏi
 * @param {string} question
 */
async function ask(userId, question) {
  const trimmed = String(question ?? "").trim().slice(0, 300);
  if (!trimmed) throw new Error("Chưa nhập câu hỏi.");
  if (!env.openaiApiKey) throw new Error("Chưa cấu hình OPENAI_API_KEY.");

  const sql = guardSql(await generateSql(trimmed));

  // Tham số userId do server truyền vào, câu lệnh chỉ được phép tham chiếu tên.
  const rows = db.prepare(sql).all({ userId });

  return {
    sql,
    rows: rows.slice(0, 50),
    columns: rows.length ? Object.keys(rows[0]) : [],
  };
}

const EXAMPLES = [
  "tôi có bao nhiêu ghi chú học tập",
  "ghi chú nào được ghim",
  "liệt kê tiêu đề ghi chú về cà phê",
  "mỗi danh mục có mấy ghi chú",
];

module.exports = { ask, guardSql, EXAMPLES };
