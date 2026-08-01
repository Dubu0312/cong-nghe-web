"use strict";

const { initDatabase } = require("../src/database/init");
const { seedDemoData } = require("../src/database/seed");
const userRepository = require("../src/repositories/user.repository");
const env = require("../src/config/env");

beforeAll(() => {
  initDatabase();
});

describe("Seed dữ liệu demo", () => {
  test("lần đầu tạo tài khoản demo kèm ghi chú mẫu", async () => {
    const result = await seedDemoData();

    expect(result.created).toBe(true);
    expect(result.notes).toBeGreaterThan(0);
    expect(userRepository.findByEmail(env.demoEmail)).toBeDefined();
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

    const result = await seedDemoData();

    expect(result.created).toBe(false);
    expect(userRepository.findByEmail(env.demoEmail).id).toBe(before.id);
  });

  test("chạy nhiều lần liên tiếp vẫn an toàn", async () => {
    for (let i = 0; i < 3; i++) {
      await expect(seedDemoData()).resolves.toEqual({ created: false });
    }
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
