"use strict";

const request = require("supertest");

/** Lấy CSRF token từ HTML trả về, mô phỏng đúng cách trình duyệt gửi form. */
function extractCsrf(html) {
  const match = /name="_csrf" value="([^"]+)"/.exec(html);
  return match ? match[1] : null;
}

async function csrfFor(agent, url) {
  const res = await agent.get(url);
  return extractCsrf(res.text);
}

/** Tạo một agent giữ cookie, đăng ký rồi đăng nhập sẵn. */
async function loginAs(app, { fullName, email, password }) {
  const agent = request.agent(app);

  const registerToken = await csrfFor(agent, "/auth/register");
  await agent.post("/auth/register").type("form").send({
    _csrf: registerToken,
    full_name: fullName,
    email,
    password,
    confirm_password: password,
  });

  const loginToken = await csrfFor(agent, "/auth/login");
  await agent.post("/auth/login").type("form").send({
    _csrf: loginToken,
    email,
    password,
  });

  return agent;
}

/** Tạo ghi chú và trả về id lấy từ URL redirect. */
async function createNote(agent, { title, content, category = "personal", isPinned = false }) {
  const token = await csrfFor(agent, "/notes/new");
  const payload = { _csrf: token, title, content, category };
  if (isPinned) payload.is_pinned = "1";

  const res = await agent.post("/notes").type("form").send(payload);
  const match = /\/notes\/(\d+)$/.exec(res.headers.location || "");
  return match ? Number.parseInt(match[1], 10) : null;
}

module.exports = { extractCsrf, csrfFor, loginAs, createNote };
