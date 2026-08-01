"use strict";

const session = require("express-session");
const db = require("../database/db");

/**
 * Session store dùng chung file SQLite của ứng dụng.
 *
 * Vì sao không dùng connect-sqlite3: package đó yêu cầu driver `sqlite3` bản 5,
 * kéo theo node-gyp và tar cũ nên `npm audit` báo lỗ hổng mức critical, đồng
 * thời phải cài hai driver SQLite song song. Tự viết store chỉ tốn vài chục
 * dòng, giữ đúng một driver và không còn cảnh báo bảo mật.
 *
 * express-session yêu cầu tối thiểu ba phương thức: get, set, destroy.
 */
class SqliteSessionStore extends session.Store {
  constructor() {
    super();
    this.statements = {
      get: db.prepare("SELECT data, expires_at FROM sessions WHERE sid = ?"),
      set: db.prepare(`
        INSERT INTO sessions (sid, data, expires_at) VALUES (@sid, @data, @expiresAt)
        ON CONFLICT(sid) DO UPDATE SET data = @data, expires_at = @expiresAt
      `),
      destroy: db.prepare("DELETE FROM sessions WHERE sid = ?"),
      clear: db.prepare("DELETE FROM sessions"),
      length: db.prepare("SELECT COUNT(*) AS total FROM sessions"),
      purge: db.prepare("DELETE FROM sessions WHERE expires_at <= ?"),
    };
  }

  get(sid, callback) {
    try {
      const row = this.statements.get.get(sid);
      if (!row) return callback(null, null);

      // Session hết hạn thì coi như không tồn tại và dọn luôn.
      if (row.expires_at <= Date.now()) {
        this.statements.destroy.run(sid);
        return callback(null, null);
      }
      return callback(null, JSON.parse(row.data));
    } catch (error) {
      return callback(error);
    }
  }

  set(sid, sessionData, callback) {
    try {
      const maxAge = sessionData.cookie?.originalMaxAge ?? 8 * 60 * 60 * 1000;
      this.statements.set.run({
        sid,
        data: JSON.stringify(sessionData),
        expiresAt: Date.now() + maxAge,
      });
      return callback(null);
    } catch (error) {
      return callback(error);
    }
  }

  destroy(sid, callback) {
    try {
      this.statements.destroy.run(sid);
      return callback(null);
    } catch (error) {
      return callback(error);
    }
  }

  touch(sid, sessionData, callback) {
    // Gia hạn session khi người dùng còn hoạt động.
    return this.set(sid, sessionData, callback);
  }

  clear(callback) {
    try {
      this.statements.clear.run();
      return callback(null);
    } catch (error) {
      return callback(error);
    }
  }

  length(callback) {
    try {
      return callback(null, this.statements.length.get().total);
    } catch (error) {
      return callback(error);
    }
  }

  /** Xóa session đã hết hạn, gọi định kỳ để bảng không phình mãi. */
  purgeExpired() {
    this.statements.purge.run(Date.now());
  }
}

module.exports = { SqliteSessionStore };
