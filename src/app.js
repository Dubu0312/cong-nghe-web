"use strict";

const path = require("node:path");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");

const env = require("./config/env");
const { sessionMiddleware } = require("./config/session");
const { locals } = require("./middleware/locals");
const { csrf } = require("./middleware/csrf");
const { notFoundHandler } = require("./middleware/not-found");
const { errorHandler } = require("./middleware/error-handler");
const authRoutes = require("./routes/auth.routes");
const noteRoutes = require("./routes/note.routes");

const app = express();

// Sau reverse proxy (Render, Railway, Fly.io) Express mặc định thấy request là
// HTTP nên sẽ không gửi cookie có secure:true — hệ quả là đăng nhập xong vẫn
// bị coi như chưa đăng nhập. Dòng này cho phép Express tin header
// X-Forwarded-Proto của proxy.
if (env.isProduction) {
  app.set("trust proxy", 1);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

// Helmet giữ nguyên CSP mặc định (default-src 'self'). Bootstrap được tự host
// trong public/vendor nên không cần nới lỏng chính sách này.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // upgrade-insecure-requests buộc trình duyệt nâng mọi request con từ
        // HTTP sang HTTPS. Trình duyệt miễn trừ localhost, nhưng khi mở app
        // qua IP trong mạng LAN (ví dụ kiểm tra trên điện thoại) thì không —
        // CSS và JS sẽ bị chặn sạch mà không báo lỗi gì trên trang.
        // Production chạy sau HTTPS thật nên vẫn bật chỉ thị này.
        upgradeInsecureRequests: env.isProduction ? [] : null,
      },
    },
  })
);

if (!env.isTest) {
  app.use(morgan(env.isProduction ? "combined" : "dev"));
}

// Giới hạn 200kb: một ký tự tiếng Việt chiếm 3 byte UTF-8, khi mã hóa form
// thành %XX%XX%XX thì thành 9 byte. Ghi chú dài 10.000 ký tự có dấu tạo body
// khoảng 90KB, nên mức 50kb sẽ chặn nhầm dữ liệu hợp lệ.
app.use(express.urlencoded({ extended: false, limit: "200kb" }));
app.use(express.json({ limit: "200kb" }));

app.use(express.static(path.join(__dirname, "..", "public"), { maxAge: "1d" }));

app.use(sessionMiddleware);
app.use(locals);
app.use(csrf);

app.get("/", (req, res) => {
  if (req.session.userId) return res.redirect("/notes");
  return res.render("home");
});

app.use("/auth", authRoutes);
app.use("/notes", noteRoutes);

// Hai middleware này phải nằm cuối cùng và đúng thứ tự.
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
