"use strict";

const fs = require("node:fs");
const path = require("node:path");

const PUBLIC_DIR = path.join(__dirname, "..", "..", "public");

/*
 * Gắn số phiên bản vào đường dẫn tệp tĩnh: /css/app.css?v=1a2b3c
 *
 * Lý do cần: tệp tĩnh được đặt cache một ngày khi chạy production, và CDN đứng
 * trước server cũng cache theo. Sau khi deploy bản mới, trình duyệt lẫn CDN vẫn
 * trả tệp cũ cho tới khi hết hạn — từng làm nút chat mất CSS và rơi xuống cuối
 * trang. Đổi số phiên bản là đổi URL, cache buộc phải lấy bản mới.
 *
 * Số phiên bản lấy từ thời điểm sửa tệp, tính một lần lúc khởi động.
 */
const versions = new Map();

function assetUrl(relativePath) {
  if (!versions.has(relativePath)) {
    let version = "0";
    try {
      version = fs
        .statSync(path.join(PUBLIC_DIR, relativePath))
        .mtimeMs.toString(36);
    } catch {
      // Không đọc được thì bỏ qua phần phiên bản, tệp vẫn tải bình thường.
    }
    versions.set(relativePath, version);
  }
  return `/${relativePath}?v=${versions.get(relativePath)}`;
}

module.exports = { assetUrl };
