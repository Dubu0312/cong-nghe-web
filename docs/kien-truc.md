# Sơ đồ kiến trúc — Note App (IT4409)

Xem trực tiếp: mở file này trong VS Code rồi bấm `Ctrl+Shift+V`, hoặc xem trên
GitHub — cả hai đều tự vẽ sơ đồ Mermaid.

---

## 1. Sơ đồ tổng quát

Toàn bộ ứng dụng chia làm 5 tầng. Quy tắc xuyên suốt: **mỗi tầng chỉ nói chuyện
với tầng ngay dưới nó**, controller không bao giờ viết SQL, repository không
bao giờ biết gì về HTTP.

```mermaid
flowchart TD
    B["Trình duyệt"]
    MW["Middleware chung<br/><i>helmet · session · locals · csrf</i>"]
    R["Router<br/><i>auth.routes.js · note.routes.js</i>"]
    C["Controller<br/>đọc request, chọn HTTP status<br/><i>auth.controller.js · note.controller.js</i>"]
    S["Service<br/>quy tắc nghiệp vụ, chuẩn hóa dữ liệu<br/><i>auth.service.js · note.service.js</i>"]
    RP["Repository<br/><b>nơi duy nhất viết SQL</b><br/>luôn kèm user_id<br/><i>user.repository.js · note.repository.js</i>"]
    DB[("SQLite<br/>users · notes · sessions")]
    V["View EJS<br/>escape mọi dữ liệu người dùng"]
    EH["Error handler<br/>404 · 403 · 500"]

    B -->|"1 · request"| MW
    MW -->|"2"| R
    R -->|"3"| C
    C -->|"4"| S
    S -->|"5"| RP
    RP -->|"6 · SQL"| DB
    C -->|"7 · dữ liệu đã có"| V
    V -->|"8 · HTML"| B

    C -.->|"ném lỗi"| EH
    S -.->|"ném lỗi"| EH
    EH -.->|"trang lỗi"| V

    classDef data fill:#e8f4ff,stroke:#4a90d9
    classDef err fill:#ffeaea,stroke:#d96a6a
    class RP,DB data
    class EH err
```

Đường đi chính là 1→8. Kết quả truy vấn quay ngược lên theo đúng chuỗi gọi hàm
(repository trả về service, service trả về controller) nên không vẽ mũi tên
ngược cho đỡ rối.

**Vì sao chia tầng như vậy:** khi cần biết "dữ liệu của người dùng có bị lộ
không", chỉ phải đọc đúng 2 file repository chứ không phải rà cả dự án. Mọi câu
truy vấn ghi chú đều nằm ở một chỗ và đều có `WHERE ... AND user_id = ?`.

---

## 2. Chuỗi middleware — thứ tự rất quan trọng

Đây là thứ tự đăng ký thật trong `src/app.js`. Đảo thứ tự là hỏng.

```mermaid
flowchart TD
    A["Request"] --> H["helmet<br/>security header + CSP"]
    H --> M["morgan<br/>ghi log"]
    M --> BP["body parser<br/>giới hạn 200kb"]
    BP --> ST["static<br/>public/"]
    ST --> SE["session<br/>đọc cookie, nạp session"]
    SE --> L["locals<br/>currentUser, flash, helper"]
    L --> CS["csrf<br/>kiểm tra token nếu là POST"]
    CS --> RA["requireAuth<br/>chỉ với /notes"]
    RA --> RT["Route handler"]
    RT --> NF["notFound<br/>URL không khớp"]
    NF --> EH["errorHandler<br/>luôn ở cuối cùng"]
```

Ba ràng buộc về thứ tự cần nhớ:

| Ràng buộc | Lý do |
|---|---|
| `body parser` phải trước `csrf` | `csrf` đọc `req.body._csrf`, chưa parse thì chưa có |
| `session` phải trước `locals` và `csrf` | Cả hai đều đọc/ghi vào `req.session` |
| `errorHandler` phải cuối cùng | Express chỉ nhận diện error handler qua 4 tham số và chỉ gọi khi mọi thứ trước đó đã bỏ qua |

---

## 3. Luồng một request cụ thể — tạo ghi chú

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant M as Middleware
    participant C as Controller
    participant S as Service
    participant R as Repository
    participant DB as SQLite

    U->>C: GET /notes/new
    C-->>U: Form kèm token ẩn _csrf

    U->>M: POST /notes

    Note over M: Cổng 1 — CSRF
    alt Token sai hoặc thiếu
        M-->>U: 403
    end

    Note over M: Cổng 2 — requireAuth
    alt Chưa đăng nhập
        M-->>U: 302 về /auth/login
    end

    Note over M: Cổng 3 — validator
    alt title/content/category sai
        M-->>U: 422 kèm form đã điền lại
    end

    M->>C: Qua cả 3 cổng
    C->>S: createNote(session.userId, form)
    Note over C,S: user_id lấy từ SESSION,<br/>không bao giờ lấy từ form
    S->>S: Sinh search_text đã bỏ dấu
    S->>R: create(...)
    R->>DB: INSERT INTO notes
    DB-->>R: id mới
    R-->>S: ghi chú
    S-->>C: ghi chú
    C-->>U: 302 tới /notes/:id
```

Điểm cần chỉ ra khi vấn đáp: có **bốn lớp chặn** trước khi dữ liệu chạm database
— CSRF, đăng nhập, validation, rồi mới tới nghiệp vụ. Và `user_id` được lấy từ
session ở tầng controller, nên dù người dùng có thêm trường ẩn `user_id` vào
form cũng vô tác dụng.

---

## 4. Mô hình dữ liệu

```mermaid
erDiagram
    USERS ||--o{ NOTES : "sở hữu"

    USERS {
        integer id PK
        text full_name
        text email UK
        text password_hash
        datetime created_at
        datetime updated_at
    }

    NOTES {
        integer id PK
        integer user_id FK
        text title
        text content
        text category
        text search_text
        integer is_pinned
        datetime created_at
        datetime updated_at
    }

    SESSIONS {
        text sid PK
        text data
        integer expires_at
    }
```

- `notes.user_id` có khóa ngoại `ON DELETE CASCADE`: xóa người dùng thì ghi chú
  của họ tự mất theo.
- `search_text` là bản `title + content` đã viết thường và bỏ dấu, chỉ phục vụ
  tìm kiếm, không bao giờ hiển thị ra giao diện.
- Bảng `sessions` do session store tự viết quản lý, không liên quan nghiệp vụ.
- Hai index: `(user_id, updated_at)` cho danh sách mặc định và
  `(user_id, category)` cho bộ lọc.

---

## 5. Bản đồ thư mục

```
src/
├── server.js          khởi tạo DB, seed, rồi listen
├── app.js             ráp middleware và router theo đúng thứ tự
├── config/            biến môi trường, session, session store
├── database/          schema.sql, kết nối, init, seed
├── routes/            khai báo endpoint, gắn middleware cho từng route
├── controllers/       đọc request, chọn status code, render view
├── services/          nghiệp vụ: phân trang, chuẩn hóa tìm kiếm, ném 404
├── repositories/      SQL, luôn kèm user_id
├── middleware/        auth, csrf, locals, validation, xử lý lỗi
├── validators/        quy tắc express-validator
└── utils/             hằng số, bỏ dấu tiếng Việt, format thời gian, AppError

views/                 EJS: partials, auth, notes, errors
public/                Bootstrap tự host, CSS, JS phía client
tests/                 Jest + Supertest, và bộ E2E chạy trên Chromium
```
