"use strict";

const request = require("supertest");
const app = require("../src/app");
const { initDatabase } = require("../src/database/init");
const noteRepository = require("../src/repositories/note.repository");
const { csrfFor, loginAs, createNote } = require("./helpers");

let alice;
let bob;
let aliceNoteId;

beforeAll(async () => {
  initDatabase();

  alice = await loginAs(app, {
    fullName: "Alice",
    email: "alice@example.com",
    password: "matkhau12345",
  });

  bob = await loginAs(app, {
    fullName: "Bob",
    email: "bob@example.com",
    password: "matkhau12345",
  });

  aliceNoteId = await createNote(alice, {
    title: "Ghi chú riêng của Alice",
    content: "Nội dung bí mật không ai được xem",
    category: "personal",
  });
});

describe("Tạo ghi chú", () => {
  test("TC-07: tạo hợp lệ thì ghi chú thuộc đúng người đang đăng nhập", async () => {
    const id = await createNote(alice, {
      title: "Ghi chú hợp lệ",
      content: "Nội dung đầy đủ",
      category: "work",
    });

    expect(id).toBeGreaterThan(0);

    const note = noteRepository.findByIdForUser(id, 1); // Alice là user đầu tiên
    expect(note).toBeDefined();
    expect(note.title).toBe("Ghi chú hợp lệ");
    expect(note.category).toBe("work");
  });

  test("user_id lấy từ session, không nhận từ form", async () => {
    const token = await csrfFor(alice, "/notes/new");

    // Cố tình gửi kèm user_id của Bob.
    const res = await alice.post("/notes").type("form").send({
      _csrf: token,
      title: "Cố gán user_id",
      content: "Thử vượt quyền bằng cách thêm trường ẩn",
      category: "other",
      user_id: 2,
    });

    const id = Number.parseInt(/\/notes\/(\d+)$/.exec(res.headers.location)[1], 10);

    // Ghi chú vẫn thuộc Alice, và Bob không thấy được.
    expect(noteRepository.findByIdForUser(id, 1)).toBeDefined();
    expect(noteRepository.findByIdForUser(id, 2)).toBeUndefined();
  });

  test("TC-08: thiếu tiêu đề thì trả 422 và không tạo bản ghi", async () => {
    const before = noteRepository.countByUser({ userId: 1 });
    const token = await csrfFor(alice, "/notes/new");

    const res = await alice.post("/notes").type("form").send({
      _csrf: token,
      title: "",
      content: "Có nội dung nhưng thiếu tiêu đề",
      category: "personal",
    });

    expect(res.status).toBe(422);
    expect(res.text).toContain("Tiêu đề là bắt buộc");
    expect(noteRepository.countByUser({ userId: 1 })).toBe(before);
  });

  test("danh mục ngoài whitelist thì trả 422", async () => {
    const token = await csrfFor(alice, "/notes/new");

    const res = await alice.post("/notes").type("form").send({
      _csrf: token,
      title: "Danh mục lạ",
      content: "Nội dung",
      category: "'; DROP TABLE notes; --",
    });

    expect(res.status).toBe(422);
    expect(res.text).toContain("Danh mục không hợp lệ");
  });

  test("form giữ lại dữ liệu đã nhập khi validation thất bại", async () => {
    const token = await csrfFor(alice, "/notes/new");

    const res = await alice.post("/notes").type("form").send({
      _csrf: token,
      title: "",
      content: "Nội dung cần được giữ lại",
      category: "idea",
    });

    expect(res.status).toBe(422);
    expect(res.text).toContain("Nội dung cần được giữ lại");
  });
});

describe("Quyền sở hữu dữ liệu (IDOR)", () => {
  test("TC-09: Bob xem ghi chú của Alice thì nhận 404, không phải 403", async () => {
    const res = await bob.get(`/notes/${aliceNoteId}`);

    expect(res.status).toBe(404);
    // Không được để lộ nội dung hay sự tồn tại của ghi chú người khác.
    expect(res.text).not.toContain("Nội dung bí mật");
  });

  test("Bob mở form sửa ghi chú của Alice cũng nhận 404", async () => {
    const res = await bob.get(`/notes/${aliceNoteId}/edit`);
    expect(res.status).toBe(404);
  });

  test("TC-10: Bob sửa ghi chú của Alice thì nhận 404 và dữ liệu không đổi", async () => {
    const before = noteRepository.findByIdForUser(aliceNoteId, 1);
    const token = await csrfFor(bob, "/notes");

    const res = await bob.post(`/notes/${aliceNoteId}`).type("form").send({
      _csrf: token,
      title: "Bị chiếm quyền",
      content: "Nội dung đã bị thay đổi",
      category: "other",
    });

    expect(res.status).toBe(404);

    const after = noteRepository.findByIdForUser(aliceNoteId, 1);
    expect(after.title).toBe(before.title);
    expect(after.content).toBe(before.content);
    expect(after.updated_at).toBe(before.updated_at);
  });

  test("TC-11: Bob xóa ghi chú của Alice thì nhận 404 và bản ghi vẫn còn", async () => {
    const token = await csrfFor(bob, "/notes");

    const res = await bob.post(`/notes/${aliceNoteId}/delete`).type("form").send({
      _csrf: token,
    });

    expect(res.status).toBe(404);
    expect(noteRepository.findByIdForUser(aliceNoteId, 1)).toBeDefined();
  });

  test("danh sách của Bob không chứa ghi chú của Alice", async () => {
    const res = await bob.get("/notes");

    expect(res.status).toBe(200);
    expect(res.text).not.toContain("Ghi chú riêng của Alice");
  });
});

describe("Xem, sửa, xóa ghi chú của chính mình", () => {
  test("TC-06b: chủ sở hữu xem được chi tiết", async () => {
    const res = await alice.get(`/notes/${aliceNoteId}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain("Ghi chú riêng của Alice");
  });

  test("cập nhật thành công và updated_at thay đổi", async () => {
    const id = await createNote(alice, {
      title: "Trước khi sửa",
      content: "Nội dung cũ",
      category: "study",
    });

    const token = await csrfFor(alice, `/notes/${id}/edit`);
    const res = await alice.post(`/notes/${id}`).type("form").send({
      _csrf: token,
      title: "Sau khi sửa",
      content: "Nội dung mới",
      category: "idea",
      is_pinned: "1",
    });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`/notes/${id}`);

    const note = noteRepository.findByIdForUser(id, 1);
    expect(note.title).toBe("Sau khi sửa");
    expect(note.category).toBe("idea");
    expect(note.is_pinned).toBe(1);
  });

  test("bỏ tích ghim thì is_pinned quay về 0", async () => {
    const id = await createNote(alice, {
      title: "Ghim rồi bỏ",
      content: "Nội dung",
      category: "other",
      isPinned: true,
    });
    expect(noteRepository.findByIdForUser(id, 1).is_pinned).toBe(1);

    // Checkbox không tích thì trình duyệt không gửi trường is_pinned.
    const token = await csrfFor(alice, `/notes/${id}/edit`);
    await alice.post(`/notes/${id}`).type("form").send({
      _csrf: token,
      title: "Ghim rồi bỏ",
      content: "Nội dung",
      category: "other",
    });

    expect(noteRepository.findByIdForUser(id, 1).is_pinned).toBe(0);
  });

  test("xóa thành công thì không xem lại được nữa", async () => {
    const id = await createNote(alice, {
      title: "Sắp bị xóa",
      content: "Nội dung",
      category: "other",
    });

    const token = await csrfFor(alice, `/notes/${id}`);
    const res = await alice.post(`/notes/${id}/delete`).type("form").send({ _csrf: token });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/notes");
    expect((await alice.get(`/notes/${id}`)).status).toBe(404);
  });

  test("xóa hai lần thì lần sau trả 404", async () => {
    const id = await createNote(alice, {
      title: "Xóa hai lần",
      content: "Nội dung",
      category: "other",
    });

    const firstToken = await csrfFor(alice, `/notes/${id}`);
    await alice.post(`/notes/${id}/delete`).type("form").send({ _csrf: firstToken });

    const secondToken = await csrfFor(alice, "/notes");
    const res = await alice.post(`/notes/${id}/delete`).type("form").send({ _csrf: secondToken });

    expect(res.status).toBe(404);
  });
});

describe("Tìm kiếm, lọc và sắp xếp", () => {
  let searcher;

  beforeAll(async () => {
    searcher = await loginAs(app, {
      fullName: "Người Tìm Kiếm",
      email: "search@example.com",
      password: "matkhau12345",
    });

    await createNote(searcher, {
      title: "Kế hoạch học Công nghệ Web",
      content: "Ôn tập HTTP và Express",
      category: "study",
    });
    await createNote(searcher, {
      title: "Đi chợ cuối tuần",
      content: "Mua rau và trứng",
      category: "personal",
    });
    await createNote(searcher, {
      title: "Báo cáo dự án",
      content: "Chuẩn bị slide thuyết trình",
      category: "work",
    });
  });

  test("TC-12: tìm kiếm chỉ trả về bản ghi khớp", async () => {
    const res = await searcher.get("/notes").query({ q: "chợ" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("Đi chợ cuối tuần");
    expect(res.text).not.toContain("Báo cáo dự án");
  });

  test("tìm kiếm không phân biệt hoa thường và không phân biệt dấu", async () => {
    for (const keyword of ["hoc", "HỌC", "Học", "hOc"]) {
      const res = await searcher.get("/notes").query({ q: keyword });
      expect(res.text).toContain("Kế hoạch học Công nghệ Web");
    }
  });

  test("tìm kiếm cả trong nội dung, không chỉ tiêu đề", async () => {
    const res = await searcher.get("/notes").query({ q: "slide" });
    expect(res.text).toContain("Báo cáo dự án");
  });

  test("không có kết quả thì hiện gợi ý xóa bộ lọc", async () => {
    const res = await searcher.get("/notes").query({ q: "khongtontaidau" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("Không có kết quả phù hợp");
  });

  test("TC-13: lọc theo danh mục chỉ trả đúng danh mục đó", async () => {
    const res = await searcher.get("/notes").query({ category: "work" });

    expect(res.text).toContain("Báo cáo dự án");
    expect(res.text).not.toContain("Đi chợ cuối tuần");
  });

  test("danh mục không hợp lệ bị bỏ qua thay vì gây lỗi", async () => {
    const res = await searcher.get("/notes").query({ category: "khong-ton-tai" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("Báo cáo dự án");
  });

  test("giá trị sort lạ không làm hỏng truy vấn", async () => {
    const res = await searcher.get("/notes").query({ sort: "; DROP TABLE notes; --" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("Báo cáo dự án");
  });

  test("ghi chú được ghim luôn đứng đầu danh sách", async () => {
    const pinner = await loginAs(app, {
      fullName: "Người Ghim",
      email: "pin@example.com",
      password: "matkhau12345",
    });

    await createNote(pinner, { title: "Ghi chú thường", content: "abc", category: "other" });
    await createNote(pinner, {
      title: "Ghi chú đã ghim",
      content: "abc",
      category: "other",
      isPinned: true,
    });

    const res = await pinner.get("/notes");
    expect(res.text.indexOf("Ghi chú đã ghim")).toBeLessThan(
      res.text.indexOf("Ghi chú thường")
    );
  });

  test("phân trang: page vượt quá tổng số trang thì hiển thị trang cuối", async () => {
    const res = await searcher.get("/notes").query({ page: 999 });

    expect(res.status).toBe(200);
    expect(res.text).toContain("trang 1/1");
  });

  test("page âm hoặc không phải số đều quy về trang 1", async () => {
    for (const page of ["-5", "abc", "0"]) {
      const res = await searcher.get("/notes").query({ page });
      expect(res.status).toBe(200);
    }
  });
});

describe("ID không hợp lệ", () => {
  test("TC-14: id không phải số nguyên dương thì trả 404", async () => {
    for (const badId of ["abc", "-1", "1.5", "0", "1%20OR%201=1"]) {
      const res = await alice.get(`/notes/${badId}`);
      expect(res.status).toBe(404);
    }
  });

  test("id đúng định dạng nhưng không tồn tại cũng trả 404", async () => {
    const res = await alice.get("/notes/999999");
    expect(res.status).toBe(404);
  });
});

describe("Chống XSS", () => {
  test("nội dung có thẻ script bị escape khi hiển thị", async () => {
    const id = await createNote(alice, {
      title: "<script>alert('xss')</script>",
      content: "<img src=x onerror=alert(1)>",
      category: "other",
    });

    const res = await alice.get(`/notes/${id}`);

    expect(res.status).toBe(200);
    expect(res.text).not.toContain("<script>alert('xss')</script>");
    expect(res.text).not.toContain("<img src=x onerror=alert(1)>");
    expect(res.text).toContain("&lt;script&gt;");
  });
});

describe("Xử lý lỗi hệ thống", () => {
  test("TC-16: lỗi database trả trang 500 và không lộ stack trace", async () => {
    const spy = jest
      .spyOn(noteRepository, "countByUser")
      .mockImplementation(() => {
        throw new Error("Giả lập lỗi database");
      });

    const res = await alice.get("/notes");

    expect(res.status).toBe(500);
    expect(res.text).toContain("Đã có lỗi xảy ra");
    expect(res.text).not.toContain("Giả lập lỗi database");
    expect(res.text).not.toMatch(/at .*\.js:\d+/); // dấu hiệu của stack trace

    spy.mockRestore();
  });
});
