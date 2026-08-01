"use strict";

const db = require("../database/db");
const { SORT_ORDER_BY, DEFAULT_SORT } = require("../utils/constants");

/*
 * Quy tắc quan trọng nhất của tầng này:
 * mọi truy vấn ghi chú đều ràng buộc user_id, không có ngoại lệ.
 * Nhờ vậy người dùng A không thể chạm tới dữ liệu của người dùng B kể cả khi
 * đoán đúng id, và việc chống IDOR không phụ thuộc vào kiểm tra ở controller.
 */

const SELECT_COLUMNS = `
  id, user_id, title, content, category, is_pinned, created_at, updated_at
`;

/** Ghép mệnh đề WHERE dùng chung cho cả truy vấn lấy danh sách và đếm. */
function buildFilter({ userId, category, searchTerm }) {
  return {
    sql: `
      WHERE user_id = ?
        AND (? = '' OR category = ?)
        AND (? = '' OR search_text LIKE '%' || ? || '%')
    `,
    params: [userId, category, category, searchTerm, searchTerm],
  };
}

function findAllByUser({ userId, category = "", searchTerm = "", sort = DEFAULT_SORT, limit, offset }) {
  const filter = buildFilter({ userId, category, searchTerm });

  // sort chỉ là khóa tra bảng whitelist; giá trị lạ rơi về mặc định.
  // ORDER BY không thể tham số hóa nên đây là cách an toàn duy nhất.
  const orderBy = SORT_ORDER_BY[sort] || SORT_ORDER_BY[DEFAULT_SORT];

  return db
    .prepare(
      `SELECT ${SELECT_COLUMNS}
       FROM notes
       ${filter.sql}
       ORDER BY is_pinned DESC, ${orderBy}
       LIMIT ? OFFSET ?`
    )
    .all(...filter.params, limit, offset);
}

function countByUser({ userId, category = "", searchTerm = "" }) {
  const filter = buildFilter({ userId, category, searchTerm });
  return db
    .prepare(`SELECT COUNT(*) AS total FROM notes ${filter.sql}`)
    .get(...filter.params).total;
}

function findByIdForUser(id, userId) {
  return db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM notes WHERE id = ? AND user_id = ?`)
    .get(id, userId);
}

function create({ userId, title, content, category, searchText, isPinned }) {
  const result = db
    .prepare(
      `INSERT INTO notes (user_id, title, content, category, search_text, is_pinned)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(userId, title, content, category, searchText, isPinned);
  return findByIdForUser(result.lastInsertRowid, userId);
}

/** Trả về số dòng bị ảnh hưởng; 0 nghĩa là không có hoặc không phải của user này. */
function update(id, userId, { title, content, category, searchText, isPinned }) {
  return db
    .prepare(
      `UPDATE notes
       SET title = ?, content = ?, category = ?, search_text = ?, is_pinned = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`
    )
    .run(title, content, category, searchText, isPinned, id, userId).changes;
}

function remove(id, userId) {
  return db
    .prepare("DELETE FROM notes WHERE id = ? AND user_id = ?")
    .run(id, userId).changes;
}

module.exports = {
  findAllByUser,
  countByUser,
  findByIdForUser,
  create,
  update,
  remove,
};
