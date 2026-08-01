"use strict";

const { initDatabase } = require("../src/database/init");
const { seedDemoData } = require("../src/database/seed");
const userRepository = require("../src/repositories/user.repository");
const noteRepository = require("../src/repositories/note.repository");
const env = require("../src/config/env");

beforeAll(() => {
  initDatabase();
});

describe("Seed dữ liệu demo", () => {
  test("lần đầu tạo cả hai tài khoản kèm ghi chú mẫu", async () => {
    const { created, accounts } = await seedDemoData();

    expect(created).toBe(true);
    expect(accounts.primary.created).toBe(true);
    expect(accounts.second.created).toBe(true);
    expect(accounts.primary.notes).toBeGreaterThan(0);
    expect(accounts.second.notes).toBeGreaterThan(0);

    expect(userRepository.findByEmail(env.demoEmail)).toBeDefined();
    expect(userRepository.findByEmail(env.demo2Email)).toBeDefined();
  });

  /*
   * Test hồi quy.
   *
   * Server gọi seed mỗi lần khởi động, nên hàm này bắt buộc phải idempotent.
   * Trước đây nó so sánh giá trị thô trong .env với email đã viết thường trong
   * database: tài khoản demo có chữ hoa (20242507M) thì lần khởi động thứ hai
   * bị coi là chưa tồn tại, seed gọi register và crash cả server.
   */
  test("gọi lần hai không lỗi và không tạo trùng", async () => {
    const before = userRepository.findByEmail(env.demoEmail);
    const before2 = userRepository.findByEmail(env.demo2Email);

    const { created } = await seedDemoData();

    expect(created).toBe(false);
    expect(userRepository.findByEmail(env.demoEmail).id).toBe(before.id);
    expect(userRepository.findByEmail(env.demo2Email).id).toBe(before2.id);
  });

  test("chạy nhiều lần liên tiếp vẫn an toàn", async () => {
    for (let i = 0; i < 3; i++) {
      const { created } = await seedDemoData();
      expect(created).toBe(false);
    }
  });
});

/*
 * Đây là phần dùng để trình bày khi vấn đáp: hai tài khoản seed phải có dữ liệu
 * tách biệt hoàn toàn, và không tài khoản nào đọc được ghi chú của tài khoản kia.
 */
describe("Hai tài khoản seed có dữ liệu tách biệt", () => {
  let primaryId;
  let secondId;

  beforeAll(() => {
    primaryId = userRepository.findByEmail(env.demoEmail).id;
    secondId = userRepository.findByEmail(env.demo2Email).id;
  });

  test("là hai người dùng khác nhau", () => {
    expect(primaryId).not.toBe(secondId);
  });

  test("mỗi tài khoản có ghi chú riêng, không giao nhau", () => {
    const ofPrimary = noteRepository.findAllByUser({
      userId: primaryId,
      limit: 100,
      offset: 0,
    });
    const ofSecond = noteRepository.findAllByUser({
      userId: secondId,
      limit: 100,
      offset: 0,
    });

    expect(ofPrimary.length).toBeGreaterThan(0);
    expect(ofSecond.length).toBeGreaterThan(0);

    // Không có id nào xuất hiện ở cả hai danh sách.
    const idsOfSecond = new Set(ofSecond.map((n) => n.id));
    expect(ofPrimary.every((n) => !idsOfSecond.has(n.id))).toBe(true);

    // Mọi ghi chú đều gắn đúng chủ sở hữu.
    expect(ofPrimary.every((n) => n.user_id === primaryId)).toBe(true);
    expect(ofSecond.every((n) => n.user_id === secondId)).toBe(true);
  });

  test("không tài khoản nào đọc được ghi chú của tài khoản kia", () => {
    const ofPrimary = noteRepository.findAllByUser({
      userId: primaryId,
      limit: 100,
      offset: 0,
    });
    const ofSecond = noteRepository.findAllByUser({
      userId: secondId,
      limit: 100,
      offset: 0,
    });

    for (const note of ofPrimary) {
      expect(noteRepository.findByIdForUser(note.id, secondId)).toBeUndefined();
    }
    for (const note of ofSecond) {
      expect(noteRepository.findByIdForUser(note.id, primaryId)).toBeUndefined();
    }
  });

  test("tìm kiếm của tài khoản này không trả về ghi chú của tài khoản kia", () => {
    // "user_test" chỉ xuất hiện trong ghi chú của tài khoản thứ hai.
    const found = noteRepository.findAllByUser({
      userId: primaryId,
      searchTerm: "user_test",
      limit: 100,
      offset: 0,
    });
    expect(found).toHaveLength(0);

    const foundByOwner = noteRepository.findAllByUser({
      userId: secondId,
      searchTerm: "user_test",
      limit: 100,
      offset: 0,
    });
    expect(foundByOwner.length).toBeGreaterThan(0);
  });
});

describe("Chuẩn hóa email khi tra cứu", () => {
  test("tìm được người dùng bất kể hoa thường", () => {
    const variants = [
      env.demoEmail,
      env.demoEmail.toUpperCase(),
      env.demoEmail.toLowerCase(),
      `  ${env.demoEmail}  `,
    ];

    for (const variant of variants) {
      expect(userRepository.findByEmail(variant)).toBeDefined();
    }
  });

  test("email được lưu ở dạng chữ thường", () => {
    const stored = userRepository.findByEmail(env.demoEmail).email;
    expect(stored).toBe(env.demoEmail.toLowerCase());
  });
});
