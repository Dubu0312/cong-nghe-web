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
document.addEventListener("DOMContentLoaded", function () {
  const widget = document.getElementById("chat-widget");
  if (!widget) return;

  const panel = document.getElementById("chat-panel");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const result = document.getElementById("chat-result");

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

  // Bấm vào câu ví dụ thì điền sẵn rồi gửi luôn.
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

  const renderTable = function (data) {
    if (!data.rows.length) return "<p class='mb-0'>Không có kết quả nào.</p>";

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
      `<div class="table-responsive"><table class="table table-sm table-bordered mb-2">` +
      `<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>` +
      `<details><summary class="text-secondary">Câu truy vấn đã dùng</summary>` +
      `<pre class="small mb-0">${escapeHtml(data.sql)}</pre></details>`
    );
  };

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;

    result.innerHTML = "<span class='text-secondary'>Đang tìm…</span>";

    try {
      const response = await fetch("/notes/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, _csrf: widget.dataset.csrf }),
      });
      const data = await response.json();

      result.innerHTML = response.ok
        ? renderTable(data)
        : `<p class="text-danger mb-0">${escapeHtml(data.error || "Có lỗi xảy ra.")}</p>`;
    } catch (error) {
      result.innerHTML = "<p class='text-danger mb-0'>Không gọi được máy chủ.</p>";
    }
  });
});
