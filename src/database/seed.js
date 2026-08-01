"use strict";

const env = require("../config/env");
const { initDatabase } = require("./init");
const userRepository = require("../repositories/user.repository");
const noteRepository = require("../repositories/note.repository");
const authService = require("../services/auth.service");
const { buildSearchText } = require("../utils/normalize");

const DEMO_NOTES = [
  {
    title: "Kế hoạch học Công nghệ Web",
    content:
      "Tuần 1: ôn HTTP, status code và cách trình duyệt gửi request.\n" +
      "Tuần 2: Express router, middleware, template engine.\n" +
      "Tuần 3: SQLite, truy vấn tham số hóa và index.\n" +
      "Tuần 4: bảo mật session, CSRF, XSS và kiểm thử phân quyền.",
    category: "study",
    isPinned: 1,
  },
  {
    title: "Danh sách việc cần làm hôm nay",
    content:
      "- Hoàn thiện phần validation cho form ghi chú\n" +
      "- Viết test cho luồng đăng nhập\n" +
      "- Chụp màn hình cho báo cáo\n" +
      "- Kiểm tra giao diện trên điện thoại",
    category: "personal",
    isPinned: 0,
  },
  {
    title: "Ý tưởng đồ án cuối kỳ",
    content:
      "Làm một ứng dụng ghi chú tối giản nhưng chắc phần bảo mật: mỗi người " +
      "chỉ thấy dữ liệu của mình, truy cập nhầm thì trả về 404 chứ không phải " +
      "403 để không lộ dữ liệu người khác có tồn tại hay không.",
    category: "idea",
    isPinned: 1,
  },
  {
    title: "Ghi chú buổi họp nhóm",
    content:
      "Chốt phạm vi: CRUD, tìm kiếm, lọc theo danh mục, phân trang.\n" +
      "Chưa làm: chia sẻ ghi chú, upload ảnh, đăng nhập bằng Google.\n" +
      "Deadline nộp bài: trước buổi vấn đáp.",
    category: "work",
    isPinned: 0,
  },
  {
    title: "Mục tiêu tuần này",
    content:
      "Đọc xong tài liệu về Content Security Policy và hiểu vì sao Helmet " +
      "chặn file tải từ CDN. Tự triển khai được CSRF token mà không cần thư viện.",
    category: "study",
    isPinned: 0,
  },
  {
    title: "Công thức pha cà phê buổi sáng",
    content:
      "18g cà phê xay vừa, 250ml nước 92 độ, ủ 30 giây rồi rót đều trong 2 phút.",
    category: "other",
    isPinned: 0,
  },
];

/**
 * Tạo tài khoản demo và dữ liệu mẫu.
 *
 * Hàm idempotent: nếu tài khoản demo đã tồn tại thì không làm gì cả. Điều này
 * cho phép gọi seed mỗi lần server khởi động mà không sinh dữ liệu trùng —
 * cần thiết khi deploy trên nền tảng không có ổ đĩa lưu trữ lâu dài.
 */
async function seedDemoData() {
  if (userRepository.findByEmail(env.demoEmail)) {
    return { created: false };
  }

  const user = await authService.register({
    fullName: "Người dùng Demo",
    email: env.demoEmail,
    password: env.demoPassword,
  });

  for (const note of DEMO_NOTES) {
    noteRepository.create({
      userId: user.id,
      title: note.title,
      content: note.content,
      category: note.category,
      searchText: buildSearchText(note.title, note.content),
      isPinned: note.isPinned,
    });
  }

  return { created: true, userId: user.id, notes: DEMO_NOTES.length };
}

module.exports = { seedDemoData };

// Cho phép chạy độc lập: npm run db:seed
if (require.main === module) {
  initDatabase();
  seedDemoData()
    .then((result) => {
      console.log(
        result.created
          ? `Đã tạo tài khoản demo ${env.demoEmail} và ${result.notes} ghi chú mẫu.`
          : `Tài khoản demo ${env.demoEmail} đã tồn tại, bỏ qua.`
      );
    })
    .catch((error) => {
      console.error("Seed thất bại:", error);
      process.exit(1);
    });
}
