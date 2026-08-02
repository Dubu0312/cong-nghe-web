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
// Câu trả lời được đọc dần theo kiểu server-sent events và render markdown ngay
// trong lúc chữ đang chạy. Lịch sử chỉ nằm trong biến, mất khi tải lại trang.
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

  /*
   * Escape trước rồi mới cho qua marked. Nhờ vậy cú pháp markdown vẫn hoạt động
   * nhưng thẻ HTML thô trong câu trả lời chỉ hiện ra dưới dạng chữ, không chạy.
   * Cách này thay cho việc phải cài thêm thư viện làm sạch HTML.
   */
  const renderMarkdown = function (text) {
    const safe = escapeHtml(text);
    return window.marked ? window.marked.parse(safe) : safe.replace(/\n/g, "<br />");
  };

  const scrollDown = function () {
    log.scrollTop = log.scrollHeight;
  };

  const bubble = function (who, html) {
    const row = document.createElement("div");
    row.className = "chat-row chat-" + who;
    row.innerHTML = '<div class="chat-bubble">' + html + "</div>";
    log.appendChild(row);
    scrollDown();
    return row.firstChild;
  };

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;

    input.value = "";
    input.disabled = true;
    sendButton.disabled = true;
    const suggestions = widget.querySelector(".chat-suggestions");
    if (suggestions) suggestions.remove();

    bubble("me", escapeHtml(question));
    const answer = bubble("bot", "<span class='chat-typing'>đang soạn…</span>");

    let text = "";
    let sql = null;

    /** Vẽ lại bong bóng với nội dung đã nhận được tới thời điểm này. */
    const paint = function (streaming) {
      let html = renderMarkdown(text);
      if (streaming) html += '<span class="chat-caret"></span>';
      if (!streaming && sql) {
        html +=
          '<details class="chat-sql"><summary>Câu truy vấn đã dùng</summary>' +
          "<pre>" + escapeHtml(sql) + "</pre></details>";
      }
      answer.innerHTML = html;
      scrollDown();
    };

    try {
      const response = await fetch("/notes/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history, _csrf: widget.dataset.csrf }),
      });

      if (!response.ok || !response.body) {
        const fallback = await response.json().catch(function () {
          return {};
        });
        throw new Error(fallback.error || "Không gọi được máy chủ.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Mỗi sự kiện là một dòng "data: {...}" ngăn nhau bằng dòng trống.
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;

        buffer += decoder.decode(chunk.value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const raw of events) {
          const line = raw.trim();
          if (!line.startsWith("data:")) continue;

          const event = JSON.parse(line.slice(5).trim());
          if (event.type === "meta") sql = event.sql;
          else if (event.type === "delta") { text += event.text; paint(true); }
          else if (event.type === "error") throw new Error(event.message);
        }
      }

      paint(false);
      history.push({ question: question, reply: text });
    } catch (error) {
      answer.innerHTML =
        '<span class="text-danger">' + escapeHtml(error.message) + "</span>";
    } finally {
      input.disabled = false;
      sendButton.disabled = false;
      input.focus();
      scrollDown();
    }
  });
});
