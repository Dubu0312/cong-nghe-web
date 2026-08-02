"use strict";

const db = require("../database/db");
const env = require("../config/env");

/*
 * Trợ lý hỏi đáp về ghi chú.
 *
 * Cách chạy hai bước:
 *   1. Hỏi mô hình xem câu này có cần tra dữ liệu không. Chào hỏi, cảm ơn hay
 *      hỏi "bạn làm được gì" thì trả lời thẳng, không đụng tới database.
 *   2. Nếu cần tra thì mô hình trả về một câu SELECT, chạy xong đưa kết quả
 *      ngược lại cho mô hình diễn đạt thành câu tiếng Việt.
 *
 * Câu lệnh do mô hình sinh ra luôn đi qua guardSql trước khi chạy: chỉ SELECT,
 * chỉ bảng notes, bắt buộc kèm :userId. Giá trị userId do server truyền vào từ
 * phiên đăng nhập nên câu hỏi không can thiệp được.
 */

const SYSTEM_PROMPT = `
Bạn là trợ lý của một ứng dụng ghi chú cá nhân, nói chuyện thân thiện bằng tiếng Việt.

Luôn trả về JSON thuần, không bọc markdown, theo một trong hai dạng:
- Cần tra dữ liệu ghi chú: {"type":"query","sql":"<một câu SELECT duy nhất>"}
- Không cần tra dữ liệu (chào hỏi, cảm ơn, hỏi bạn là ai, hỏi làm được gì,
  hoặc câu ngoài phạm vi ghi chú): {"type":"chat","reply":"<câu trả lời>"}

Bảng duy nhất được phép truy vấn:
  notes(id, user_id, title, content, category, is_pinned, created_at, updated_at)
  category thuộc: personal (cá nhân), study (học tập), work (công việc),
  idea (ý tưởng), other (khác). is_pinned = 1 nghĩa là được ghim.

Quy tắc cho SQL:
- Chỉ SELECT. Không sửa, xóa, tạo bảng. Không đụng bảng users hay sessions.
- Bắt buộc có điều kiện user_id = :userId
- Bắt buộc có LIMIT, tối đa 50.
- So chuỗi thì dùng lower(...) LIKE cho không phân biệt hoa thường.

Nếu người dùng yêu cầu xem dữ liệu của người khác hoặc yêu cầu sửa/xóa, hãy trả
về type "chat" và giải thích ngắn gọn rằng bạn chỉ tra cứu được ghi chú của
chính họ.
`.trim();

const CHAT_PROMPT = `
Bạn là trợ lý của một ứng dụng ghi chú cá nhân, nói chuyện thân thiện bằng tiếng
Việt, trả lời ngắn gọn. Bạn tra cứu được ghi chú của chính người đang đăng nhập:
đếm, tìm theo từ khóa, lọc theo danh mục, xem ghi chú được ghim, tóm tắt nội
dung. Bạn không sửa hay xóa ghi chú, và không xem được dữ liệu của người khác.
Có thể dùng markdown đơn giản: in đậm và gạch đầu dòng.
`.trim();

const ANSWER_PROMPT = `
Bạn là trợ lý của ứng dụng ghi chú. Dựa vào dữ liệu truy vấn được, trả lời câu
hỏi của người dùng bằng tiếng Việt ngắn gọn, tự nhiên, không nhắc tới SQL hay
tên cột kỹ thuật. Nếu không có dữ liệu thì nói rõ là không tìm thấy.
Dùng markdown: gạch đầu dòng khi liệt kê, in đậm cho tiêu đề ghi chú và con số.
`.trim();

const FORBIDDEN =
  /\b(insert|update|delete|drop|alter|create|replace|attach|detach|pragma|vacuum|users|sessions)\b/i;

const MAX_HISTORY_TURNS = 5;

/** Kiểm tra câu lệnh trước khi chạy, ném lỗi nếu không đạt. */
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

/**
 * Gọi mô hình ở chế độ streaming, gọi onDelta cho từng mẩu chữ nhận được.
 * Trả về toàn bộ nội dung sau khi xong.
 */
async function streamModel(messages, onDelta) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: env.openaiModel, messages, stream: true }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) throw new Error(`Gọi mô hình thất bại (${res.status}).`);

  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });

    // Mỗi sự kiện của OpenAI là một dòng "data: {...}", ngăn nhau bằng dòng trống.
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;

      try {
        const piece = JSON.parse(payload).choices?.[0]?.delta?.content;
        if (piece) {
          full += piece;
          onDelta(piece);
        }
      } catch {
        // Mẩu chưa đủ để parse thì bỏ qua, vòng sau sẽ có tiếp.
      }
    }
  }

  return full;
}

async function callModel(messages, { json = false } = {}) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.openaiModel,
      messages,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`Gọi mô hình thất bại (${res.status}).`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/** Lịch sử do trình duyệt gửi lên, chỉ lấy đúng hai trường và cắt bớt độ dài. */
function buildHistoryMessages(history) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-MAX_HISTORY_TURNS)
    .flatMap((turn) => [
      { role: "user", content: String(turn?.question ?? "").slice(0, 300) },
      { role: "assistant", content: String(turn?.reply ?? "").slice(0, 400) },
    ])
    .filter((m) => m.content);
}

/**
 * @param {number} userId   lấy từ phiên đăng nhập, không bao giờ từ câu hỏi
 * @param {string} question
 * @param {Array}  history  các lượt trước, trình duyệt giữ và gửi kèm
 */
/**
 * @param {number}   userId    lấy từ phiên đăng nhập, không bao giờ từ câu hỏi
 * @param {string}   question
 * @param {Array}    history   các lượt trước, trình duyệt giữ và gửi kèm
 * @param {Function} onEvent   nhận {type:"meta"|"delta", ...} để đẩy dần về client
 */
async function ask(userId, question, history, onEvent = () => {}) {
  const trimmed = String(question ?? "").trim().slice(0, 300);
  if (!trimmed) throw new Error("Chưa nhập câu hỏi.");
  if (!env.openaiApiKey) throw new Error("Chưa cấu hình OPENAI_API_KEY.");

  const historyMessages = buildHistoryMessages(history);

  // Bước 1: cần tra dữ liệu hay chỉ trò chuyện? Bước này cần JSON trọn vẹn nên
  // không stream được, nhưng phản hồi rất ngắn nên hầu như không thấy chờ.
  const raw = await callModel(
    [
      { role: "system", content: SYSTEM_PROMPT },
      ...historyMessages,
      { role: "user", content: trimmed },
    ],
    { json: true }
  );

  let decision = {};
  try {
    decision = JSON.parse(raw);
  } catch {
    decision = { type: "chat", reply: raw.trim() };
  }

  // Bước 2: nội dung trả lời luôn được stream, dù có tra dữ liệu hay không.
  let messages;
  let sql = null;

  if (decision.type === "query") {
    sql = guardSql(decision.sql);
    const rows = db.prepare(sql).all({ userId }).slice(0, 50);
    onEvent({ type: "meta", sql });

    messages = [
      { role: "system", content: ANSWER_PROMPT },
      {
        role: "user",
        content:
          `Câu hỏi: ${trimmed}\n\n` +
          `Dữ liệu (JSON): ${JSON.stringify(rows).slice(0, 6000)}`,
      },
    ];
  } else {
    messages = [
      { role: "system", content: CHAT_PROMPT },
      ...historyMessages,
      { role: "user", content: trimmed },
    ];
  }

  const reply = await streamModel(messages, (piece) =>
    onEvent({ type: "delta", text: piece })
  );

  return { reply: reply.trim(), sql };
}

const EXAMPLES = [
  "tôi có bao nhiêu ghi chú học tập",
  "ghi chú nào đang được ghim",
  "tóm tắt các ghi chú công việc",
];

module.exports = { ask, guardSql, EXAMPLES };
