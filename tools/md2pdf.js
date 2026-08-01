/*
 * Xuất docs/nop-bai.md thành PDF bằng Chromium, dùng khi máy không có pandoc.
 *
 * Cách chạy:
 *   npm install -D playwright marked
 *   npx playwright install chromium
 *   node tools/md2pdf.js
 *
 * Kết quả: docs/[IT4409]_CuoiKy20252_20242507M_NguyenDucManh.pdf
 */
const { chromium } = require("playwright");
const { marked } = require("marked");
const fs = require("node:fs");
const path = require("node:path");

const DOCS = path.join(__dirname, "..", "docs");
const SRC = path.join(DOCS, "nop-bai.md");
const OUT = path.join(DOCS, "[IT4409]_CuoiKy20252_20242507M_NguyenDucManh.pdf");

const body = marked.parse(fs.readFileSync(SRC, "utf8"));

const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: "DejaVu Sans", "Noto Sans", system-ui, sans-serif;
         font-size: 10.5pt; line-height: 1.55; color: #1a1a1a; }
  h1 { font-size: 19pt; border-bottom: 2px solid #333; padding-bottom: 6px; }
  h2 { font-size: 14pt; margin-top: 22px; border-bottom: 1px solid #ccc;
       padding-bottom: 4px; break-after: avoid; }
  h3 { font-size: 11.5pt; margin-top: 16px; break-after: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0;
          font-size: 9.5pt; break-inside: avoid; }
  th, td { border: 1px solid #bbb; padding: 5px 8px; text-align: left;
           vertical-align: top; }
  th { background: #f0f0f0; }
  code { font-family: "DejaVu Sans Mono", monospace; font-size: 9pt;
         background: #f4f4f4; padding: 1px 4px; border-radius: 3px; }
  pre { background: #f6f6f6; border: 1px solid #ddd; border-radius: 4px;
        padding: 9px 11px; font-size: 8.5pt; overflow-wrap: break-word;
        white-space: pre-wrap; break-inside: avoid; }
  pre code { background: none; padding: 0; font-size: 8.5pt; }
  /* Giới hạn cả chiều cao: ảnh chụp mobile rất cao, nếu chỉ giới hạn chiều
     rộng thì mỗi ảnh chiếm gần trọn một trang. */
  img { max-width: 100%; max-height: 145mm; width: auto; border: 1px solid #ccc;
        border-radius: 4px; display: block; margin: 8px auto;
        break-inside: avoid; }
  blockquote { border-left: 3px solid #999; margin: 10px 0; padding: 4px 12px;
               color: #444; background: #fafafa; }
  hr { border: none; border-top: 1px solid #ddd; margin: 18px 0; }
  ul, ol { padding-left: 22px; }
  li { margin: 3px 0; }
</style></head><body>${body}</body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // baseURL là thư mục docs để các đường dẫn ảnh tương đối phân giải được.
  await page.goto(`file://${DOCS}/`);
  await page.setContent(html, { waitUntil: "networkidle" });

  // Chờ mọi ảnh nạp xong, tránh PDF có ô trắng.
  const loaded = await page.evaluate(async () => {
    const imgs = [...document.images];
    await Promise.all(imgs.map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
    return { total: imgs.length, ok: imgs.filter(i => i.naturalWidth > 0).length };
  });
  console.log(`  ảnh: ${loaded.ok}/${loaded.total} nạp được`);

  await page.pdf({ path: OUT, format: "A4", printBackground: true });
  await browser.close();
  console.log(`  đã ghi ${OUT}`);
})();
