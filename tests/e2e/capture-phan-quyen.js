"use strict";

/*
 * Chụp ảnh bằng chứng phân quyền dữ liệu để đưa vào báo cáo nộp bài.
 *
 * Kịch bản: đăng nhập hai tài khoản trong hai phiên riêng, chụp danh sách của
 * từng tài khoản, rồi cho tài khoản A mở đúng URL ghi chú của tài khoản B để
 * chụp lại trang 404.
 *
 * Cách chạy:
 *   npm run dev                                    (cửa sổ khác)
 *   node tests/e2e/capture-phan-quyen.js
 */

const { chromium } = require("playwright");
const path = require("node:path");
const fs = require("node:fs");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = path.join(__dirname, "..", "..", "docs", "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });

const ACCOUNT_A = { user: process.env.DEMO_EMAIL || "20242507M", pass: "12345678" };
const ACCOUNT_B = { user: process.env.DEMO2_EMAIL || "user_test", pass: "12345678" };

/** Mở một phiên trình duyệt riêng và đăng nhập. */
async function openSession(browser, account) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${BASE}/auth/login`);
  await page.fill("#email", account.user);
  await page.fill("#password", account.pass);
  await page.click("button[type=submit]");
  await page.waitForURL(`${BASE}/notes`);

  return page;
}

(async () => {
  const browser = await chromium.launch();

  const pageA = await openSession(browser, ACCOUNT_A);
  const pageB = await openSession(browser, ACCOUNT_B);

  // Danh sách riêng của từng tài khoản.
  await pageB.screenshot({ path: path.join(SHOTS, "11-danh-sach-user-test.png"), fullPage: true });
  const titlesB = await pageB.locator("article.card h2").allInnerTexts();
  const titlesA = await pageA.locator("article.card h2").allInnerTexts();

  console.log(`  ${ACCOUNT_A.user} thấy ${titlesA.length} ghi chú`);
  console.log(`  ${ACCOUNT_B.user} thấy ${titlesB.length} ghi chú`);

  const overlap = titlesA.filter((t) => titlesB.includes(t));
  console.log(`  số tiêu đề trùng nhau giữa hai tài khoản: ${overlap.length}`);

  // Lấy URL một ghi chú của tài khoản B rồi mở bằng phiên của tài khoản A.
  const href = await pageB.locator("article.card h2 a").first().getAttribute("href");
  await pageA.goto(BASE + href);

  const status = await pageA
    .evaluate(() => document.body.innerText.includes("Không tìm thấy nội dung"));
  console.log(`  ${ACCOUNT_A.user} mở ${href} của ${ACCOUNT_B.user} → ${status ? "trang 404" : "XEM ĐƯỢC — LỖI"}`);

  await pageA.screenshot({ path: path.join(SHOTS, "12-truy-cap-cheo-404.png"), fullPage: true });

  await browser.close();

  if (overlap.length !== 0 || !status) {
    console.error("\nPhân quyền KHÔNG đạt.");
    process.exit(1);
  }
  console.log("\nPhân quyền đạt. Đã lưu 2 ảnh vào docs/screenshots/");
})();
