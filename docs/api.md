# Tham chiếu endpoint và mã trạng thái HTTP

Ứng dụng render HTML phía server nên đây **không phải REST API trả JSON** — mọi
endpoint trả về HTML hoặc redirect. Tài liệu này liệt kê đầy đủ 13 route và mọi
mã trạng thái mà ứng dụng chủ động sinh ra.

Toàn bộ bảng dưới đây đã được kiểm chứng bằng request thật, xem mục
[Kiểm chứng](#kiểm-chứng) ở cuối.

---

## 1. Thứ tự các lớp chặn

Một request đi qua các lớp theo đúng thứ tự này. Lớp nào chặn trước thì mã của
lớp đó thắng.

```
1. csrf         →  403  (chỉ với POST)
2. requireAuth  →  302  về /auth/login
3. guestOnly    →  302  về /notes
4. validator    →  422
5. controller   →  404 / 409 / 200 / 302
6. errorHandler →  500
```

Ví dụ: gửi `POST /notes` mà vừa thiếu CSRF token vừa chưa đăng nhập vừa sai dữ
liệu → nhận **403**, vì `csrf` chặn trước tiên.

---

## 2. Route công khai

| Method | Path | Yêu cầu | Thành công | Lỗi có thể gặp |
|---|---|---|---|---|
| GET | `/` | — | `200` trang giới thiệu | `302` → `/notes` nếu đã đăng nhập |
| GET | `/auth/register` | khách | `200` form đăng ký | `302` → `/notes` nếu đã đăng nhập |
| POST | `/auth/register` | khách | `302` → `/auth/login` | `403` CSRF · `422` dữ liệu sai · `409` email trùng |
| GET | `/auth/login` | khách | `200` form đăng nhập | `302` → `/notes` nếu đã đăng nhập |
| POST | `/auth/login` | khách | `302` → `/notes` | `403` CSRF · `422` thiếu trường · `401` sai thông tin |
| POST | `/auth/logout` | đã đăng nhập | `302` → `/auth/login` | `403` CSRF · `302` → `/auth/login` nếu chưa đăng nhập |

Lưu ý về `POST /auth/logout` khi chưa đăng nhập: nếu thiếu `_csrf` thì nhận `403`
chứ không phải `302`, vì `csrf` đứng trước `requireAuth` trong chuỗi middleware.
Chỉ khi gửi kèm token hợp lệ mà không có session thì mới nhận `302`.

### POST `/auth/register`

| Trường | Quy tắc |
|---|---|
| `full_name` | bắt buộc, 2–100 ký tự |
| `email` | bắt buộc, đúng định dạng email, lưu ở dạng chữ thường |
| `password` | tối thiểu 8 ký tự |
| `confirm_password` | phải khớp `password` |
| `_csrf` | bắt buộc |

### POST `/auth/login`

| Trường | Quy tắc |
|---|---|
| `email` | bắt buộc, nhận **cả email lẫn mã học viên** |
| `password` | bắt buộc |
| `_csrf` | bắt buộc |

Sai email hoặc sai mật khẩu đều trả `401` với **cùng một thông báo** để không
tiết lộ email nào đã đăng ký.

---

## 3. Route yêu cầu đăng nhập

Toàn bộ nhóm này nếu chưa đăng nhập đều trả `302` về `/auth/login`, **không trả
`401`** — vì đây là ứng dụng HTML, người dùng cần thấy form đăng nhập.

| Method | Path | Thành công | Lỗi có thể gặp |
|---|---|---|---|
| GET | `/notes` | `200` danh sách | `500` |
| GET | `/notes/new` | `200` form tạo | — |
| POST | `/notes` | `302` → `/notes/:id` | `403` CSRF · `422` dữ liệu sai |
| GET | `/notes/:id` | `200` chi tiết | `404` |
| GET | `/notes/:id/edit` | `200` form sửa | `404` |
| POST | `/notes/:id` | `302` → `/notes/:id` | `403` CSRF · `404` · `422` |
| POST | `/notes/:id/delete` | `302` → `/notes` | `403` CSRF · `404` |

### Tham số query của GET `/notes`

| Tham số | Giá trị | Mặc định | Giá trị lạ |
|---|---|---|---|
| `q` | từ khóa, tối đa 100 ký tự | rỗng | cắt bớt |
| `category` | `personal` `study` `work` `idea` `other` | rỗng (tất cả) | bỏ qua, không lỗi |
| `sort` | `updated_desc` `updated_asc` `created_desc` `title_asc` | `updated_desc` | rơi về mặc định |
| `page` | số nguyên ≥ 1 | 1 | kẹp về khoảng hợp lệ |

Giá trị lạ **không bao giờ** gây lỗi 400 — đều được whitelist hoặc ép kiểu rồi
bỏ qua. Ghi chú được ghim luôn đứng đầu ở mọi kiểu sắp xếp.

### Trường dữ liệu của POST `/notes` và POST `/notes/:id`

| Trường | Quy tắc |
|---|---|
| `title` | bắt buộc, 1–150 ký tự |
| `content` | bắt buộc, tối đa 10.000 ký tự |
| `category` | bắt buộc, thuộc whitelist 5 giá trị |
| `is_pinned` | tùy chọn; checkbox không tích thì trình duyệt không gửi, quy về `0` |
| `_csrf` | bắt buộc |

`user_id` **không nhận từ form** — luôn lấy từ session. Gửi kèm `user_id` trong
body sẽ bị bỏ qua hoàn toàn.

### Quy tắc `:id`

Phải là số nguyên dương. Các giá trị `abc`, `-1`, `1.5`, `0` đều trả `404` chứ
không phải `400` — chỉ một đường xử lý và không tiết lộ thông tin.

---

## 4. Danh mục mã trạng thái

Đây là **toàn bộ** mã mà ứng dụng chủ động sinh ra.

| Mã | Khi nào | Trả về gì |
|---|---|---|
| `200` | Render trang thành công | HTML |
| `302` | Sau POST thành công · chưa đăng nhập · đã đăng nhập mà mở lại trang login/register | `Location` header |
| `401` | Sai email hoặc mật khẩu ở `POST /auth/login` | Form login kèm thông báo chung |
| `403` | CSRF token thiếu hoặc không hợp lệ | Trang 403 |
| `404` | Route không tồn tại · ghi chú không tồn tại · ghi chú không thuộc người dùng hiện tại · `:id` sai định dạng | Trang 404 |
| `409` | Email đã được đăng ký | Form register kèm lỗi ở trường email |
| `422` | Dữ liệu form không hợp lệ | Form kèm lỗi dưới từng ô, giữ lại dữ liệu đã nhập |
| `500` | Lỗi hệ thống không dự kiến | Trang 500, không lộ stack trace |

### Hai mã cố ý không dùng

| Mã | Vì sao |
|---|---|
| `400` | Mọi lỗi đầu vào đã quy về `422`; `:id` sai định dạng quy về `404`. Giữ một quy ước duy nhất cho dễ đoán. |
| `403` cho quyền sở hữu | Trả `403` khi truy cập ghi chú của người khác sẽ **xác nhận ghi chú đó tồn tại**. Quy về `404` để không tiết lộ gì. `403` chỉ dùng cho CSRF. |

---

## 5. Nếu cần thêm API JSON

Hiện không có endpoint JSON nào. Nếu sau này cần (ví dụ để làm app mobile), cách
mở rộng ít xáo trộn nhất:

- Thêm router `/api/notes` dùng **chung service** đang có, nhờ vậy ràng buộc
  `user_id` vẫn giữ nguyên.
- Middleware `requireAuth` trả `401` JSON thay vì `302`, phân biệt bằng
  `req.path.startsWith("/api")`.
- `errorHandler` trả JSON thay vì render view với cùng điều kiện.

---

## Kiểm chứng

Bảng ở trên không viết theo trí nhớ. Script `tests/e2e/verify-status.sh` gửi
request thật cho từng tổ hợp (route, tình huống) rồi so mã nhận được với mã ghi
trong tài liệu này.

```bash
npm run dev                                      # cửa sổ khác
BASE_URL=http://localhost:3000 bash tests/e2e/verify-status.sh
```
