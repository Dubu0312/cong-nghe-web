#!/usr/bin/env bash
#
# Kiểm chứng docs/api.md: gửi request thật cho từng tổ hợp (route, tình huống)
# rồi so mã trạng thái nhận được với mã đã ghi trong tài liệu.
#
# Cách chạy:
#   npm run dev                                    (cửa sổ khác)
#   BASE_URL=http://localhost:3000 bash tests/e2e/verify-status.sh
#
set -u

B="${BASE_URL:-http://localhost:3000}"
USER="${DEMO_EMAIL:-20242507M}"
PASS_WORD="${DEMO_PASSWORD:-12345678}"

pass=0
fail=0

guest=$(mktemp)   # cookie jar chưa đăng nhập
auth=$(mktemp)    # cookie jar đã đăng nhập

# $1 mô tả · $2 mã mong đợi · $3 mã thực tế
chk() {
  if [ "$2" = "$3" ]; then
    printf "  OK   %-52s %s\n" "$1" "$3"
    pass=$((pass + 1))
  else
    printf "  FAIL %-52s mong đợi %s, nhận %s\n" "$1" "$2" "$3"
    fail=$((fail + 1))
  fi
}

code() { curl -s -o /dev/null -w '%{http_code}' -b "$1" -c "$1" "${@:2}"; }
csrf() {
  curl -s -b "$1" -c "$1" "$2" |
    grep -o 'name="_csrf" value="[^"]*"' | head -1 | sed 's/.*value="//;s/"//'
}

echo "Kiểm chứng docs/api.md trên $B"
echo

# ── Chuẩn bị: một phiên đã đăng nhập ──────────────────────────────────────────
t=$(csrf "$auth" "$B/auth/login")
curl -s -o /dev/null -b "$auth" -c "$auth" -X POST \
  -d "_csrf=$t&email=$USER&password=$PASS_WORD" "$B/auth/login"

# Một ghi chú để thử các route có :id
t=$(csrf "$auth" "$B/notes/new")
loc=$(curl -s -o /dev/null -w '%{redirect_url}' -b "$auth" -c "$auth" -X POST \
  -d "_csrf=$t&title=Ghi chú kiểm chứng&content=Nội dung&category=other" "$B/notes")
NID=$(echo "$loc" | grep -o '[0-9]*$')

echo "== Mục 2 · Route công khai"
chk "GET / (khách) = 200"                200 "$(code "$guest" "$B/")"
chk "GET / (đã đăng nhập) = 302"         302 "$(code "$auth" "$B/")"
chk "GET /auth/register (khách) = 200"   200 "$(code "$guest" "$B/auth/register")"
chk "GET /auth/register (đã login) = 302" 302 "$(code "$auth" "$B/auth/register")"
chk "GET /auth/login (khách) = 200"      200 "$(code "$guest" "$B/auth/login")"
chk "GET /auth/login (đã login) = 302"   302 "$(code "$auth" "$B/auth/login")"

echo "== Mục 2 · POST /auth/register"
chk "thiếu _csrf = 403" 403 "$(code "$guest" -X POST -d "email=a@b.co&password=matkhau123" "$B/auth/register")"
t=$(csrf "$guest" "$B/auth/register")
chk "mật khẩu ngắn = 422" 422 "$(code "$guest" -X POST -d "_csrf=$t&full_name=Test User&email=new$$@example.com&password=123&confirm_password=123" "$B/auth/register")"
t=$(csrf "$guest" "$B/auth/register")
chk "xác nhận không khớp = 422" 422 "$(code "$guest" -X POST -d "_csrf=$t&full_name=Test User&email=new$$@example.com&password=matkhau123&confirm_password=khac123456" "$B/auth/register")"
t=$(csrf "$guest" "$B/auth/register")
chk "email sai định dạng = 422" 422 "$(code "$guest" -X POST -d "_csrf=$t&full_name=Test User&email=khong-phai-email&password=matkhau123&confirm_password=matkhau123" "$B/auth/register")"
t=$(csrf "$guest" "$B/auth/register")
chk "hợp lệ = 302" 302 "$(code "$guest" -X POST -d "_csrf=$t&full_name=Test User&email=verify$$@example.com&password=matkhau123&confirm_password=matkhau123" "$B/auth/register")"
t=$(csrf "$guest" "$B/auth/register")
chk "email trùng = 409" 409 "$(code "$guest" -X POST -d "_csrf=$t&full_name=Test User&email=verify$$@example.com&password=matkhau123&confirm_password=matkhau123" "$B/auth/register")"

echo "== Mục 2 · POST /auth/login"
chk "thiếu _csrf = 403" 403 "$(code "$guest" -X POST -d "email=$USER&password=$PASS_WORD" "$B/auth/login")"
t=$(csrf "$guest" "$B/auth/login")
chk "thiếu mật khẩu = 422" 422 "$(code "$guest" -X POST -d "_csrf=$t&email=$USER&password=" "$B/auth/login")"
t=$(csrf "$guest" "$B/auth/login")
chk "sai mật khẩu = 401" 401 "$(code "$guest" -X POST -d "_csrf=$t&email=$USER&password=saibetroi" "$B/auth/login")"
t=$(csrf "$guest" "$B/auth/login")
chk "email không tồn tại = 401" 401 "$(code "$guest" -X POST -d "_csrf=$t&email=khongtontai@example.com&password=saibetroi" "$B/auth/login")"

echo "== Mục 3 · Chưa đăng nhập thì 302, không phải 401"
for p in "/notes" "/notes/new" "/notes/1" "/notes/1/edit"; do
  chk "GET $p = 302" 302 "$(code "$guest" "$B$p")"
done

echo "== Mục 3 · Route đã đăng nhập"
chk "GET /notes = 200"            200 "$(code "$auth" "$B/notes")"
chk "GET /notes/new = 200"        200 "$(code "$auth" "$B/notes/new")"
chk "GET /notes/\$id = 200"        200 "$(code "$auth" "$B/notes/$NID")"
chk "GET /notes/\$id/edit = 200"   200 "$(code "$auth" "$B/notes/$NID/edit")"

echo "== Mục 3 · POST /notes"
chk "thiếu _csrf = 403" 403 "$(code "$auth" -X POST -d "title=x&content=y&category=other" "$B/notes")"
t=$(csrf "$auth" "$B/notes/new")
chk "thiếu title = 422" 422 "$(code "$auth" -X POST -d "_csrf=$t&title=&content=y&category=other" "$B/notes")"
t=$(csrf "$auth" "$B/notes/new")
chk "category ngoài whitelist = 422" 422 "$(code "$auth" -X POST -d "_csrf=$t&title=x&content=y&category=hacked" "$B/notes")"

echo "== Mục 3 · POST /notes/:id"
t=$(csrf "$auth" "$B/notes/$NID/edit")
chk "cập nhật hợp lệ = 302" 302 "$(code "$auth" -X POST -d "_csrf=$t&title=Đã sửa&content=Nội dung mới&category=idea" "$B/notes/$NID")"
t=$(csrf "$auth" "$B/notes/$NID/edit")
chk "id không tồn tại = 404" 404 "$(code "$auth" -X POST -d "_csrf=$t&title=x&content=y&category=other" "$B/notes/999999")"
t=$(csrf "$auth" "$B/notes/$NID/edit")
chk "thiếu title = 422" 422 "$(code "$auth" -X POST -d "_csrf=$t&title=&content=y&category=other" "$B/notes/$NID")"

echo "== Mục 3 · Quy tắc :id"
for bad in abc -1 1.5 0 999999; do
  chk "GET /notes/$bad = 404" 404 "$(code "$auth" "$B/notes/$bad")"
done

echo "== Mục 3 · Tham số query giá trị lạ không gây lỗi"
chk "category lạ = 200" 200 "$(code "$auth" "$B/notes?category=khongtontai")"
chk "sort lạ = 200"     200 "$(code "$auth" "$B/notes?sort=;DROP+TABLE+notes")"
chk "page=999 = 200"    200 "$(code "$auth" "$B/notes?page=999")"
chk "page=-5 = 200"     200 "$(code "$auth" "$B/notes?page=-5")"
chk "page=abc = 200"    200 "$(code "$auth" "$B/notes?page=abc")"
chk "q rất dài = 200"   200 "$(code "$auth" "$B/notes?q=$(printf 'a%.0s' $(seq 1 300))")"

echo "== Mục 4 · Route không tồn tại"
chk "GET /khong-ton-tai = 404" 404 "$(code "$guest" "$B/khong-ton-tai")"
chk "GET /notes/1/khong-ton-tai = 404" 404 "$(code "$auth" "$B/notes/1/khong-ton-tai")"

echo "== Mục 1 · Thứ tự ưu tiên các lớp chặn"
# Vừa thiếu CSRF vừa chưa đăng nhập vừa sai dữ liệu → csrf thắng, trả 403.
chk "POST /notes: thiếu csrf + chưa login = 403" 403 "$(code "$guest" -X POST -d "title=&category=hacked" "$B/notes")"

echo "== Mục 3 · POST /notes/:id/delete"
t=$(csrf "$auth" "$B/notes/$NID")
chk "thiếu _csrf = 403" 403 "$(code "$auth" -X POST "$B/notes/$NID/delete")"
chk "xóa hợp lệ = 302"  302 "$(code "$auth" -X POST -d "_csrf=$t" "$B/notes/$NID/delete")"
t=$(csrf "$auth" "$B/notes")
chk "xóa lần hai = 404" 404 "$(code "$auth" -X POST -d "_csrf=$t" "$B/notes/$NID/delete")"

echo "== Mục 2 · POST /auth/logout"
# Khách vẫn được cấp CSRF token khi mở trang, nên phải gửi kèm token hợp lệ mới
# đi tới được requireAuth. Thiếu token thì csrf chặn trước và trả 403.
t=$(csrf "$guest" "$B/auth/login")
chk "token hợp lệ nhưng chưa đăng nhập = 302" 302 "$(code "$guest" -X POST -d "_csrf=$t" "$B/auth/logout")"
t=$(csrf "$auth" "$B/notes")
chk "thiếu _csrf = 403"    403 "$(code "$auth" -X POST "$B/auth/logout")"
t=$(csrf "$auth" "$B/notes")
chk "hợp lệ = 302"         302 "$(code "$auth" -X POST -d "_csrf=$t" "$B/auth/logout")"

# ── Dọn dẹp ───────────────────────────────────────────────────────────────────
# Phần kiểm tra 409 cần đăng ký thật một tài khoản, nên phải xóa lại để không
# tích rác trong database sau mỗi lần chạy.
#
# Chỉ dọn khi đang kiểm chứng server chạy trên chính máy này. Nếu BASE_URL trỏ
# tới bản deploy thì database nằm ở máy khác, xóa ở đây là xóa sai chỗ — khi đó
# in ra cảnh báo để tự xử lý.
case "$B" in
  http://localhost*|http://127.0.0.1*) local_db=1 ;;
  *) local_db=0 ;;
esac

if [ "$local_db" -eq 0 ]; then
  echo
  echo "Lưu ý: đang kiểm chứng server từ xa nên không dọn được tài khoản test."
  echo "       Phần kiểm tra 409 đã tạo một tài khoản verify...@example.com trên đó."
elif [ -f "$(dirname "$0")/../../src/database/db.js" ]; then
  cleaned=$(cd "$(dirname "$0")/../.." && node -e "
    const db = require('./src/database/db');
    const r = db.prepare(\"DELETE FROM users WHERE email LIKE 'verify%@example.com'\").run();
    console.log(r.changes);
  " 2>/dev/null | tail -1)
  echo
  echo "Đã dọn $cleaned tài khoản test."
fi

echo
echo "PASS=$pass FAIL=$fail"
[ "$fail" -eq 0 ]
