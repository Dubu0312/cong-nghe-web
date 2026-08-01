"use strict";

/*
 * Kiểm thử đầu-cuối bằng trình duyệt thật (Chromium qua Playwright).
 *
 * Khác với test Jest + Supertest ở thư mục cha: ở đây CSS và JavaScript thực sự
 * được trình duyệt thực thi, nên bắt được những lỗi mà test ở tầng HTTP không
 * thấy — CSP chặn tài nguyên, lỗi JavaScript, bố cục tràn ngang trên mobile,
 * hộp thoại xác nhận khi xóa.
 *
 * Đây là phần tùy chọn, không nằm trong `npm test` để `npm ci` khỏi phải tải
 * trình duyệt. Cách chạy:
 *
 *   npm install -D playwright
 *   npx playwright install chromium
 *   npm run dev                                  (cửa sổ khác)
 *   BASE_URL=http://localhost:3000 node tests/e2e/browser.js
 *
 * Ảnh chụp màn hình được lưu vào docs/screenshots/ để dùng cho README và file
 * PDF nộp bài.
 */

const { chromium } = require("playwright");
const path = require("node:path");
const fs = require("node:fs");

const BASE = process.env.BASE_URL || "http://localhost:3000";

// Đọc từ biến môi trường để đổi tài khoản demo không phải sửa file test.
const DEMO_USER = process.env.DEMO_EMAIL || "20242507M";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "12345678";

const SHOTS = path.join(__dirname, "..", "..", "docs", "screenshots");
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0;
let fail = 0;
const consoleErrors = [];
const failedRequests = [];

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  OK   ${name}${detail ? " — " + detail : ""}`);
    pass++;
  } else {
    console.log(`  FAIL ${name}${detail ? " — " + detail : ""}`);
    fail++;
  }
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

/** Kiểm tra trang không bị tràn ngang — yêu cầu responsive quan trọng nhất. */
async function noHorizontalOverflow(page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
  );
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    // Chromium ghi console error cho mọi response 4xx/5xx. Kịch bản test có cố
    // tình tạo ra 422 (validation) và 404 (ghi chú không tồn tại), đó là hành vi
    // đúng chứ không phải lỗi JavaScript, nên bỏ qua nhóm này.
    if (msg.text().startsWith("Failed to load resource")) return;
    consoleErrors.push(msg.text());
  });
  page.on("requestfailed", (req) => failedRequests.push(`${req.url()} — ${req.failure()?.errorText}`));
  page.on("response", (res) => {
    if (res.status() >= 400 && res.url().startsWith(BASE) && /\.(css|js)$/.test(res.url())) {
      failedRequests.push(`${res.url()} — HTTP ${res.status()}`);
    }
  });

  console.log("== Trang đăng nhập và tài nguyên tĩnh");
  await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
  check("tiêu đề trang đúng", (await page.title()).includes("Đăng nhập"));

  // Bootstrap có thực sự được áp dụng không? Nếu CSP chặn thì các giá trị này
  // sẽ về mặc định của trình duyệt.
  const styles = await page.evaluate(() => {
    const btn = document.querySelector("button[type=submit]");
    const body = document.body;
    return {
      btnBg: getComputedStyle(btn).backgroundColor,
      btnRadius: getComputedStyle(btn).borderRadius,
      bodyFont: getComputedStyle(body).fontFamily,
    };
  });
  check("Bootstrap được áp dụng (nút có màu nền)", styles.btnBg !== "rgba(0, 0, 0, 0)", styles.btnBg);
  check("Bootstrap được áp dụng (bo góc)", styles.btnRadius !== "0px", styles.btnRadius);
  check("font hệ thống của Bootstrap", styles.bodyFont.includes("system-ui"));
  check("hiển thị thông tin tài khoản demo", await page.getByText(DEMO_USER).isVisible());
  await shot(page, "01-dang-nhap");

  console.log("== Đăng nhập");
  await page.fill("#email", DEMO_USER);
  await page.fill("#password", DEMO_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL(`${BASE}/notes`);
  check("vào được danh sách sau đăng nhập", page.url() === `${BASE}/notes`);
  check("navbar hiện tên người dùng", await page.getByText("Người dùng Demo").first().isVisible());

  console.log("== Danh sách ghi chú");
  const cardCount = await page.locator("article.card").count();
  check("hiển thị các card ghi chú", cardCount > 0, `${cardCount} card`);
  const firstCardTitle = await page.locator("article.card h2").first().innerText();
  check("ghi chú ghim nằm đầu danh sách", firstCardTitle.includes("Kế hoạch học"), firstCardTitle);
  check("không tràn ngang ở desktop", await noHorizontalOverflow(page));
  await shot(page, "02-danh-sach-desktop");

  console.log("== Tìm kiếm không dấu (gõ trực tiếp vào ô tìm kiếm)");
  await page.fill("#q", "hoc");
  await page.click('button[type=submit]:has-text("Áp dụng")');
  await page.waitForLoadState("networkidle");
  const found = await page.locator("article.card").count();
  check("gõ 'hoc' tìm được ghi chú có dấu 'học'", found > 0, `${found} kết quả`);
  check("URL giữ trạng thái tìm kiếm", page.url().includes("q=hoc"), page.url());

  await page.fill("#q", "HỌC");
  await page.click('button[type=submit]:has-text("Áp dụng")');
  await page.waitForLoadState("networkidle");
  check("gõ 'HỌC' hoa có dấu cũng ra kết quả", (await page.locator("article.card").count()) > 0);
  await shot(page, "03-tim-kiem");

  console.log("== Lọc theo danh mục");
  await page.goto(`${BASE}/notes`);
  await page.selectOption("#category", "work");
  await page.click('button[type=submit]:has-text("Áp dụng")');
  await page.waitForLoadState("networkidle");
  const badges = await page.locator("article.card .badge.text-bg-light").allInnerTexts();
  check("chỉ còn ghi chú thuộc Công việc", badges.every((b) => b.trim() === "Công việc"), badges.join(", "));

  console.log("== Trạng thái không có kết quả");
  await page.goto(`${BASE}/notes?q=khongtontaidau`);
  check("hiện gợi ý xóa bộ lọc", await page.getByText("Không có kết quả phù hợp").isVisible());
  // Có hai nút "Xóa bộ lọc" hợp lệ: một ở thanh lọc, một trong empty state.
  check("có nút Xóa bộ lọc", (await page.getByRole("link", { name: "Xóa bộ lọc" }).count()) >= 1);
  await shot(page, "04-khong-co-ket-qua");

  console.log("== Tạo ghi chú");
  await page.goto(`${BASE}/notes/new`);
  await page.fill("#title", "Ghi chú tạo bằng Playwright");
  await page.fill("#content", "Dòng một\nDòng hai\nDòng ba");

  // Bộ đếm ký tự là JS phía client — nếu CSP chặn script thì nó sẽ đứng ở 0.
  const counter = await page.locator("#content-counter").innerText();
  check("bộ đếm ký tự hoạt động", counter !== "0", `${counter} ký tự`);

  await page.selectOption("#category", "idea");
  await page.check("#is_pinned");
  await shot(page, "05-form-tao");
  await page.click('button[type=submit]:has-text("Lưu")');
  await page.waitForURL(/\/notes\/\d+$/);
  const noteUrl = page.url();
  check("chuyển tới trang chi tiết sau khi tạo", /\/notes\/\d+$/.test(noteUrl), noteUrl);

  console.log("== Trang chi tiết");
  check("hiện thông báo thành công", await page.getByText("Tạo ghi chú thành công").isVisible());
  check("hiện badge ghim", await page.getByText("Ghim").first().isVisible());
  const whiteSpace = await page.evaluate(
    () => getComputedStyle(document.querySelector(".note-content")).whiteSpace
  );
  check("nội dung giữ xuống dòng", whiteSpace === "pre-wrap", whiteSpace);
  await shot(page, "06-chi-tiet");

  console.log("== Sửa ghi chú");
  await page.click('a:has-text("Sửa")');
  await page.waitForURL(/\/edit$/);
  const prefilled = await page.inputValue("#title");
  check("form sửa điền sẵn dữ liệu cũ", prefilled === "Ghi chú tạo bằng Playwright", prefilled);
  await page.fill("#title", "Tiêu đề đã sửa");
  await page.click('button[type=submit]:has-text("Lưu")');
  await page.waitForURL(noteUrl);
  check("tiêu đề đã đổi", (await page.locator("h1").innerText()) === "Tiêu đề đã sửa");

  console.log("== Validation hiển thị trên giao diện");
  await page.goto(`${BASE}/notes/new`);
  await page.fill("#title", "");
  await page.fill("#content", "có nội dung");
  // novalidate ở form nên trình duyệt không chặn, request đi tới server.
  await page.click('button[type=submit]:has-text("Lưu")');
  await page.waitForLoadState("networkidle");
  check("lỗi hiện ngay dưới ô nhập", await page.locator("#title ~ .invalid-feedback").isVisible());
  check("giữ lại nội dung đã gõ", (await page.inputValue("#content")) === "có nội dung");
  await shot(page, "07-validation");

  console.log("== Xóa có hộp thoại xác nhận");
  await page.goto(noteUrl);
  let dialogMessage = null;
  page.once("dialog", async (dialog) => {
    dialogMessage = dialog.message();
    await dialog.accept();
  });
  await page.click('button:has-text("Xóa")');
  await page.waitForURL(`${BASE}/notes`);
  check("có hộp thoại xác nhận trước khi xóa", dialogMessage !== null, dialogMessage || "");
  check("báo đã xóa", await page.getByText("Đã xóa ghi chú").isVisible());

  console.log("== Hủy xóa thì dữ liệu còn nguyên");
  const keepUrl = await page.locator("article.card h2 a").first().getAttribute("href");
  await page.goto(BASE + keepUrl);
  const keepTitle = await page.locator("h1").innerText();
  page.once("dialog", async (dialog) => dialog.dismiss());
  await page.click('button:has-text("Xóa")');
  await page.waitForTimeout(300);
  check("bấm Hủy thì không xóa", (await page.locator("h1").innerText()) === keepTitle);

  console.log("== Trang 404");
  await page.goto(`${BASE}/notes/999999`);
  check("ghi chú không tồn tại trả trang 404", await page.getByText("Không tìm thấy nội dung").isVisible());
  await shot(page, "08-404");

  console.log("== Responsive");
  for (const [name, width, height] of [
    ["mobile", 360, 800],
    ["tablet", 768, 1024],
    ["desktop", 1366, 768],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${BASE}/notes`, { waitUntil: "networkidle" });
    check(`${name} ${width}px: không tràn ngang`, await noHorizontalOverflow(page));

    if (name === "mobile") {
      const toggler = page.locator(".navbar-toggler");
      check("mobile: navbar thu gọn thành nút hamburger", await toggler.isVisible());

      // Menu phải đóng lúc đầu, mở ra khi bấm. Chỉ xét link trong navbar,
      // vì nút "Tạo ghi chú" trong nội dung trang luôn hiển thị.
      const navLink = page.locator("#mainNav").getByRole("link", { name: "Tạo ghi chú" });
      const linkBefore = await navLink.isVisible();
      await toggler.click();
      await page.waitForTimeout(500);
      const linkAfter = await navLink.isVisible();
      check("mobile: bấm hamburger thì menu mở ra", !linkBefore && linkAfter);

      // Danh sách phải xếp một cột.
      const columns = await page.evaluate(() => {
        const cards = [...document.querySelectorAll("article.card")];
        if (cards.length < 2) return 1;
        return new Set(cards.map((c) => Math.round(c.getBoundingClientRect().left))).size;
      });
      check("mobile: danh sách xếp một cột", columns === 1, `${columns} cột`);

      // Vùng chạm của nút thao tác.
      const btnHeight = await page.evaluate(() => {
        const btn = document.querySelector("article.card .btn-sm");
        return btn ? Math.round(btn.getBoundingClientRect().height) : 0;
      });
      check("mobile: nút cao tối thiểu 40px", btnHeight >= 40, `${btnHeight}px`);

      await shot(page, "09-danh-sach-mobile");
      await page.goto(`${BASE}/notes/new`);
      await shot(page, "10-form-mobile");
    }

    if (name === "desktop") {
      const columns = await page.evaluate(() => {
        const cards = [...document.querySelectorAll("article.card")];
        return new Set(cards.map((c) => Math.round(c.getBoundingClientRect().left))).size;
      });
      check("desktop: danh sách xếp nhiều cột", columns > 1, `${columns} cột`);
    }
  }

  console.log("== Điều hướng bằng bàn phím");
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${BASE}/notes`);
  await page.keyboard.press("Tab");
  const focusOutline = await page.evaluate(() => {
    const el = document.activeElement;
    return { tag: el.tagName, outline: getComputedStyle(el).outlineWidth };
  });
  check("Tab di chuyển được tiêu điểm", focusOutline.tag !== "BODY", focusOutline.tag);

  console.log("== Đăng xuất");
  await page.click('button:has-text("Đăng xuất")');
  await page.waitForURL(`${BASE}/auth/login`);
  check("đăng xuất về trang đăng nhập", page.url() === `${BASE}/auth/login`);
  await page.goto(`${BASE}/notes`);
  check("sau đăng xuất không vào được /notes", page.url() === `${BASE}/auth/login`);

  console.log("== Tổng hợp lỗi trình duyệt");
  check("không có lỗi JavaScript trong console", consoleErrors.length === 0, consoleErrors.join(" | "));
  check("không có tài nguyên nào tải lỗi", failedRequests.length === 0, failedRequests.join(" | "));

  await browser.close();

  console.log(`\nPASS=${pass} FAIL=${fail}`);
  console.log(`Ảnh chụp lưu tại ${SHOTS}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((error) => {
  console.error("Lỗi khi chạy E2E:", error);
  process.exit(1);
});
