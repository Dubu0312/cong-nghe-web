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

// ─── Trợ lý hỏi đáp về ghi chú ───────────────────────────────────────────────
// Lịch sử hội thoại chỉ nằm trong biến này, mất khi tải lại trang.
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

  /** Thêm một bong bóng vào khung hội thoại. */
  const bubble = function (who, html) {
    const row = document.createElement("div");
    row.className = "chat-row chat-" + who;
    row.innerHTML = '<div class="chat-bubble">' + html + "</div>";
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return row.firstChild;
  };

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;

    input.value = "";
    input.disabled = true;
    sendButton.disabled = true;
    widget.querySelector(".chat-suggestions")?.remove();

    bubble("me", escapeHtml(question));
    const answer = bubble("bot", "<span class='chat-typing'>đang soạn…</span>");

    try {
      const response = await fetch("/notes/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history, _csrf: widget.dataset.csrf }),
      });
      const data = await response.json();

      if (response.ok) {
        // Giữ xuống dòng của câu trả lời, vẫn escape nội dung.
        let html = escapeHtml(data.reply).replace(/\n/g, "<br />");
        if (data.sql) {
          html +=
            '<details class="chat-sql"><summary>Câu truy vấn đã dùng</summary>' +
            "<pre>" + escapeHtml(data.sql) + "</pre></details>";
        }
        answer.innerHTML = html;
        history.push({ question: question, reply: data.reply });
      } else {
        answer.innerHTML = '<span class="text-danger">' +
          escapeHtml(data.error || "Có lỗi xảy ra.") + "</span>";
      }
    } catch (error) {
      answer.innerHTML = '<span class="text-danger">Không gọi được máy chủ.</span>';
    } finally {
      input.disabled = false;
      sendButton.disabled = false;
      input.focus();
      log.scrollTop = log.scrollHeight;
    }
  });
});
