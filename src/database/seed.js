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

/*
 * Bộ ghi chú của tài khoản thứ hai.
 *
 * Nội dung cố tình khác hẳn bộ trên để khi trình bày có thể chỉ ra ngay: đăng
 * nhập bằng tài khoản nào thì chỉ thấy đúng bộ ghi chú của tài khoản đó.
 */
const SECOND_USER_NOTES = [
  {
    title: "Ghi chú riêng của user_test",
    content:
      "Ghi chú này thuộc tài khoản user_test. Nếu đăng nhập bằng tài khoản khác " +
      "mà vẫn đọc được nội dung này thì tức là phân quyền dữ liệu đã hỏng.\n\n" +
      "Cách kiểm tra: sao chép URL của ghi chú này, đăng xuất, đăng nhập bằng " +
      "tài khoản còn lại rồi mở URL đó — kết quả phải là trang 404.",
    category: "personal",
    isPinned: 1,
  },
  {
    title: "Mật khẩu wifi nhà",
    content:
      "Đây là ví dụ về dữ liệu mà chủ sở hữu không muốn ai khác đọc được.\n" +
      "Wifi: PhongTro301 — mật khẩu: khongphaimatkhauthat",
    category: "personal",
    isPinned: 0,
  },
  {
    title: "Việc cần làm ở công ty",
    content:
      "- Gửi báo cáo tuần cho quản lý\n" +
      "- Chuẩn bị slide cho buổi họp thứ Năm\n" +
      "- Rà soát lại hợp đồng với đối tác",
    category: "work",
    isPinned: 0,
  },
  {
    title: "Ý tưởng khởi nghiệp",
    content:
      "Làm một ứng dụng đặt sân cầu lông theo giờ, có bản đồ sân gần nhất và " +
      "cho phép ghép nhóm chơi cùng.",
    category: "idea",
    isPinned: 0,
  },
  {
    title: "Lịch ôn thi học kỳ",
    content:
      "Thứ Hai: Giải tích. Thứ Ba: Đại số. Thứ Tư: Vật lý.\n" +
      "Mỗi buổi hai tiếng, nghỉ mười phút giữa giờ.",
    category: "study",
    isPinned: 0,
  },
];

/**
 * Tạo một tài khoản kèm bộ ghi chú của nó.
 *
 * Bỏ qua nếu tài khoản đã tồn tại, nhờ vậy gọi bao nhiêu lần cũng an toàn.
 */
async function createAccountWithNotes({ fullName, email, password, notes }) {
  if (userRepository.findByEmail(email)) {
    return { created: false };
  }

  const user = await authService.register({ fullName, email, password });

  for (const note of notes) {
    noteRepository.create({
      userId: user.id,
      title: note.title,
      content: note.content,
      category: note.category,
      searchText: buildSearchText(note.title, note.content),
      isPinned: note.isPinned,
    });
  }

  return { created: true, userId: user.id, notes: notes.length };
}

/**
 * Tạo hai tài khoản demo và dữ liệu mẫu.
 *
 * Tài khoản thứ hai không phải để dự phòng mà là một phần của phần trình bày:
 * có hai người dùng với hai bộ dữ liệu riêng thì mới chứng minh được mỗi người
 * chỉ truy cập được dữ liệu của chính mình.
 *
 * Hàm idempotent: tài khoản nào đã tồn tại thì bỏ qua. Điều này cho phép gọi
 * seed mỗi lần server khởi động mà không sinh dữ liệu trùng — cần thiết khi
 * deploy trên nền tảng không có ổ đĩa lưu trữ lâu dài.
 */
async function seedDemoData() {
  const primary = await createAccountWithNotes({
    fullName: "Người dùng Demo",
    email: env.demoEmail,
    password: env.demoPassword,
    notes: DEMO_NOTES,
  });

  const second = await createAccountWithNotes({
    fullName: "User Test",
    email: env.demo2Email,
    password: env.demo2Password,
    notes: SECOND_USER_NOTES,
  });

  return {
    created: primary.created || second.created,
    accounts: { primary, second },
  };
}

module.exports = { seedDemoData };

// Cho phép chạy độc lập: npm run db:seed
if (require.main === module) {
  initDatabase();
  seedDemoData()
    .then(({ accounts }) => {
      for (const [email, r] of [
        [env.demoEmail, accounts.primary],
        [env.demo2Email, accounts.second],
      ]) {
        console.log(
          r.created
            ? `Đã tạo tài khoản ${email} kèm ${r.notes} ghi chú mẫu.`
            : `Tài khoản ${email} đã tồn tại, bỏ qua.`
        );
      }
    })
    .catch((error) => {
      console.error("Seed thất bại:", error);
      process.exit(1);
    });
}
