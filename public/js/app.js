"use strict";

// JavaScript phía client chỉ hỗ trợ trải nghiệm. Mọi ràng buộc thật đều được
// kiểm tra lại ở server, nên tắt JS cũng không ảnh hưởng tính đúng đắn.

document.addEventListener("DOMContentLoaded", function () {
  // Hỏi xác nhận trước khi xóa.
  document.querySelectorAll("form[data-confirm]").forEach(function (form) {
    form.addEventListener("submit", function (event) {
      if (!window.confirm(form.dataset.confirm)) {
        event.preventDefault();
      }
    });
  });

  // Bộ đếm ký tự cho ô nội dung.
  document.querySelectorAll("textarea[data-counter]").forEach(function (textarea) {
    const counter = document.getElementById(textarea.dataset.counter);
    if (!counter) return;

    const update = function () {
      counter.textContent = textarea.value.length.toLocaleString("vi-VN");
    };
    textarea.addEventListener("input", update);
    update();
  });
});

// ─── Khung hỏi đáp về ghi chú ────────────────────────────────────────────────
// Gửi câu hỏi lên server, server nhờ mô hình ngôn ngữ dựng câu truy vấn rồi
// trả kết quả về dạng JSON. Toàn bộ phần sinh và chạy truy vấn nằm ở server.
//
// Lịch sử hội thoại chỉ nằm trong biến này, mất khi tải lại trang. Không lưu
// vào server hay database — đủ để hỏi nối tiếp trong một phiên làm việc.
document.addEventListener("DOMContentLoaded", function () {
  const widget = document.getElementById("chat-widget");
  if (!widget) return;

  const panel = document.getElementById("chat-panel");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const log = document.getElementById("chat-log");
  const sendButton = form.querySelector("button[type=submit]");

  const history = [];

  const open = function (isOpen) {
    panel.classList.toggle("d-none", !isOpen);
    if (isOpen) input.focus();
  };

  document.getElementById("chat-toggle").addEventListener("click", function () {
    open(panel.classList.contains("d-none"));
  });
  document.getElementById("chat-close").addEventListener("click", function () {
    open(false);
  });

  widget.querySelectorAll(".chat-example").forEach(function (button) {
    button.addEventListener("click", function () {
      input.value = button.textContent.trim();
      form.requestSubmit();
    });
  });

  const escapeHtml = function (value) {
    const div = document.createElement("div");
    div.textContent = value === null || value === undefined ? "" : String(value);
    return div.innerHTML;
  };

  /** Thêm một khối vào khung hội thoại và cuộn xuống cuối. */
  const append = function (html) {
    const item = document.createElement("div");
    item.className = "chat-item";
    item.innerHTML = html;
    log.appendChild(item);
    log.scrollTop = log.scrollHeight;
    return item;
  };

  const renderAnswer = function (data) {
    if (!data.rows.length) return "<div class='text-secondary'>Không có kết quả nào.</div>";

    const head = data.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
    const body = data.rows
      .map(
        (row) =>
          "<tr>" +
          data.columns.map((c) => `<td>${escapeHtml(row[c])}</td>`).join("") +
          "</tr>"
      )
      .join("");

    return (
      `<div class="table-responsive"><table class="table table-sm table-bordered mb-1">` +
      `<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>` +
      `<details><summary class="text-secondary small">Câu truy vấn đã dùng</summary>` +
      `<pre class="small mb-0">${escapeHtml(data.sql)}</pre></details>`
    );
  };

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;

    input.value = "";
    input.disabled = true;
    sendButton.disabled = true;

    append(`<div class="chat-question">${escapeHtml(question)}</div>`);
    const answer = append("<div class='text-secondary'>Đang tìm…</div>");

    try {
      const response = await fetch("/notes/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history: history,
          _csrf: widget.dataset.csrf,
        }),
      });
      const data = await response.json();

      if (response.ok) {
        answer.innerHTML = renderAnswer(data);
        // Ghi lại lượt này để câu hỏi sau hiểu được ngữ cảnh.
        history.push({ question: question, sql: data.sql });
      } else {
        answer.innerHTML = `<div class="text-danger">${escapeHtml(data.error || "Có lỗi xảy ra.")}</div>`;
      }
    } catch (error) {
      answer.innerHTML = "<div class='text-danger'>Không gọi được máy chủ.</div>";
    } finally {
      input.disabled = false;
      sendButton.disabled = false;
      input.focus();
    }
  });
});
