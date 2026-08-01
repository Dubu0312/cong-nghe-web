"use strict";

const request = require("supertest");
const app = require("../src/app");
const { initDatabase } = require("../src/database/init");
const userRepository = require("../src/repositories/user.repository");
const { csrfFor, loginAs } = require("./helpers");

beforeAll(() => {
  // NODE_ENV=test nên database chạy trong RAM, không đụng vào data/app.db.
  initDatabase();
});

describe("Đăng ký", () => {
  test("TC-01: đăng ký hợp lệ thì tạo user và chuyển về trang đăng nhập", async () => {
    const agent = request.agent(app);
    const token = await csrfFor(agent, "/auth/register");

    const res = await agent.post("/auth/register").type("form").send({
      _csrf: token,
      full_name: "Nguyễn Văn A",
      email: "TC01@Example.com",
      password: "matkhau12345",
      confirm_password: "matkhau12345",
    });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/auth/login");

    // Email phải được chuẩn hóa về chữ thường khi lưu.
    const user = userRepository.findByEmail("tc01@example.com");
    expect(user).toBeDefined();
    expect(user.full_name).toBe("Nguyễn Văn A");
  });

  test("mật khẩu được hash, không lưu dạng thô", async () => {
    const agent = request.agent(app);
    const token = await csrfFor(agent, "/auth/register");
    await agent.post("/auth/register").type("form").send({
      _csrf: token,
      full_name: "Hash Test",
      email: "hash@example.com",
      password: "matkhau12345",
      confirm_password: "matkhau12345",
    });

    const user = userRepository.findByEmail("hash@example.com");
    expect(user.password_hash).not.toBe("matkhau12345");
    expect(user.password_hash).toMatch(/^\$2[aby]\$/); // định dạng bcrypt
  });

  test("TC-02: email trùng thì trả 409 và không tạo thêm user", async () => {
    const agent = request.agent(app);
    const payload = {
      full_name: "Trùng Email",
      email: "duplicate@example.com",
      password: "matkhau12345",
      confirm_password: "matkhau12345",
    };

    const firstToken = await csrfFor(agent, "/auth/register");
    await agent.post("/auth/register").type("form").send({ ...payload, _csrf: firstToken });

    const secondToken = await csrfFor(agent, "/auth/register");
    const res = await agent
      .post("/auth/register")
      .type("form")
      .send({ ...payload, _csrf: secondToken });

    expect(res.status).toBe(409);
    expect(res.text).toContain("Email đã được sử dụng");
  });

  test("TC-03: mật khẩu ngắn hơn 8 ký tự thì trả 422", async () => {
    const agent = request.agent(app);
    const token = await csrfFor(agent, "/auth/register");

    const res = await agent.post("/auth/register").type("form").send({
      _csrf: token,
      full_name: "Mật Khẩu Ngắn",
      email: "short@example.com",
      password: "1234",
      confirm_password: "1234",
    });

    expect(res.status).toBe(422);
    expect(res.text).toContain("Mật khẩu phải có ít nhất 8 ký tự");
    expect(userRepository.findByEmail("short@example.com")).toBeUndefined();
  });

  test("xác nhận mật khẩu không khớp thì trả 422", async () => {
    const agent = request.agent(app);
    const token = await csrfFor(agent, "/auth/register");

    const res = await agent.post("/auth/register").type("form").send({
      _csrf: token,
      full_name: "Không Khớp",
      email: "mismatch@example.com",
      password: "matkhau12345",
      confirm_password: "matkhau99999",
    });

    expect(res.status).toBe(422);
    expect(res.text).toContain("Mật khẩu xác nhận không khớp");
  });

  test("form giữ lại dữ liệu đã nhập khi validation thất bại", async () => {
    const agent = request.agent(app);
    const token = await csrfFor(agent, "/auth/register");

    const res = await agent.post("/auth/register").type("form").send({
      _csrf: token,
      full_name: "Giữ Lại Dữ Liệu",
      email: "keep@example.com",
      password: "123",
      confirm_password: "123",
    });

    expect(res.status).toBe(422);
    expect(res.text).toContain("Giữ Lại Dữ Liệu");
    expect(res.text).toContain("keep@example.com");
  });
});

describe("Đăng nhập và đăng xuất", () => {
  const credentials = {
    fullName: "Người Đăng Nhập",
    email: "login@example.com",
    password: "matkhau12345",
  };

  test("TC-04: đăng nhập đúng thì tạo session và vào được /notes", async () => {
    const agent = await loginAs(app, credentials);

    const res = await agent.get("/notes");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Ghi chú của tôi");
  });

  test("TC-05: sai mật khẩu thì trả 401 với thông báo chung", async () => {
    const agent = request.agent(app);
    const token = await csrfFor(agent, "/auth/login");

    const res = await agent.post("/auth/login").type("form").send({
      _csrf: token,
      email: credentials.email,
      password: "sai-mat-khau",
    });

    expect(res.status).toBe(401);
    expect(res.text).toContain("Email hoặc mật khẩu không chính xác");
  });

  test("email không tồn tại trả cùng thông báo, không tiết lộ email nào đã đăng ký", async () => {
    const agent = request.agent(app);
    const token = await csrfFor(agent, "/auth/login");

    const res = await agent.post("/auth/login").type("form").send({
      _csrf: token,
      email: "khong-ton-tai@example.com",
      password: "sai-mat-khau",
    });

    expect(res.status).toBe(401);
    expect(res.text).toContain("Email hoặc mật khẩu không chính xác");
    expect(res.text).not.toContain("không tồn tại");
  });

  test("session ID được đổi sau khi đăng nhập (chống session fixation)", async () => {
    const agent = request.agent(app);

    // Chạm vào trang login để server cấp một session ẩn danh kèm CSRF token.
    const before = await agent.get("/auth/login");
    const cookieBefore = before.headers["set-cookie"]?.join(";") || "";
    const token = await csrfFor(agent, "/auth/login");

    const res = await agent.post("/auth/login").type("form").send({
      _csrf: token,
      email: credentials.email,
      password: credentials.password,
    });

    const cookieAfter = res.headers["set-cookie"]?.join(";") || "";
    expect(res.status).toBe(302);
    expect(cookieAfter).not.toBe("");
    expect(cookieAfter).not.toBe(cookieBefore);
  });

  test("đăng xuất hủy session, vào lại /notes bị đẩy về trang đăng nhập", async () => {
    const agent = await loginAs(app, {
      fullName: "Đăng Xuất",
      email: "logout@example.com",
      password: "matkhau12345",
    });

    const token = await csrfFor(agent, "/notes");
    const res = await agent.post("/auth/logout").type("form").send({ _csrf: token });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/auth/login");

    const after = await agent.get("/notes");
    expect(after.status).toBe(302);
    expect(after.headers.location).toBe("/auth/login");
  });

  test("người đã đăng nhập mở lại /auth/login thì bị đẩy về /notes", async () => {
    const agent = await loginAs(app, {
      fullName: "Guest Only",
      email: "guestonly@example.com",
      password: "matkhau12345",
    });

    const res = await agent.get("/auth/login");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/notes");
  });
});

describe("Bảo vệ route", () => {
  test("TC-06: chưa đăng nhập truy cập /notes thì chuyển về trang đăng nhập", async () => {
    const res = await request(app).get("/notes");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/auth/login");
  });

  test("chưa đăng nhập cũng không xem được chi tiết ghi chú", async () => {
    const res = await request(app).get("/notes/1");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/auth/login");
  });
});

describe("CSRF", () => {
  test("TC-17: POST thiếu _csrf thì bị từ chối với 403", async () => {
    const agent = request.agent(app);
    await agent.get("/auth/login"); // nhận cookie session

    const res = await agent
      .post("/auth/login")
      .type("form")
      .send({ email: "login@example.com", password: "matkhau12345" });

    expect(res.status).toBe(403);
  });

  test("_csrf sai giá trị cũng bị từ chối", async () => {
    const agent = request.agent(app);
    await agent.get("/auth/login");

    const res = await agent.post("/auth/login").type("form").send({
      _csrf: "a".repeat(64),
      email: "login@example.com",
      password: "matkhau12345",
    });

    expect(res.status).toBe(403);
  });
});

describe("Trang lỗi", () => {
  test("TC-15: route không tồn tại trả trang 404", async () => {
    const res = await request(app).get("/duong-dan-khong-ton-tai");

    expect(res.status).toBe(404);
    expect(res.text).toContain("Không tìm thấy nội dung");
  });
});
