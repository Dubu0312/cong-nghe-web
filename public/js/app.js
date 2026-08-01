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
