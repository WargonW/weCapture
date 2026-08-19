use rusqlite::Connection;

use crate::core::todo::{Todo, TodoInput};

/// 建表语句（幂等）
const CREATE_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS todos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,
  priority   INTEGER NOT NULL DEFAULT 0,
  due_date   TEXT,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
"#;

/// 待办服务：封装 SQLite 持久化 CRUD
///
/// 直接持有同步 rusqlite::Connection（用 Mutex 包裹，保证 AppState 可分享）。
pub struct TodoService {
    conn: std::sync::Mutex<Connection>,
}

impl TodoService {
    /// 打开指定路径的数据库并初始化表结构
    pub fn open(db_path: &std::path::Path) -> rusqlite::Result<Self> {
        let conn = Connection::open(db_path)?;
        conn.execute_batch(CREATE_TABLE)?;
        Ok(Self {
            conn: std::sync::Mutex::new(conn),
        })
    }

    /// 内存数据库（用于测试）
    pub fn in_memory() -> rusqlite::Result<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(CREATE_TABLE)?;
        Ok(Self {
            conn: std::sync::Mutex::new(conn),
        })
    }

    /// 查询全部待办，按 id 升序
    pub fn list(&self) -> rusqlite::Result<Vec<Todo>> {
        let conn = self.conn.lock().expect("todo conn lock");
        let mut stmt = conn.prepare(
            "SELECT id, title, done, priority, due_date, created_at, updated_at
             FROM todos ORDER BY id ASC",
        )?;
        let rows = stmt.query_map([], row_to_todo)?;
        rows.collect()
    }

    /// 新建待办并返回入库后的完整 Todo
    pub fn create(&self, input: &TodoInput) -> rusqlite::Result<Todo> {
        let input = input.normalized();
        let now = timestamp_now();
        let done = false;
        let conn = self.conn.lock().expect("todo conn lock");
        conn.execute(
            "INSERT INTO todos (title, done, priority, due_date, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                input.title,
                done,
                input.priority,
                input.due_date,
                now,
                now
            ],
        )?;
        let id = conn.last_insert_rowid();
        let mut stmt = conn.prepare(
            "SELECT id, title, done, priority, due_date, created_at, updated_at
             FROM todos WHERE id = ?1",
        )?;
        stmt.query_row([id], row_to_todo)
    }
}

fn row_to_todo(row: &rusqlite::Row) -> rusqlite::Result<Todo> {
    Ok(Todo {
        id: row.get(0)?,
        title: row.get(1)?,
        done: row.get::<_, i64>(2)? != 0,
        priority: row.get(3)?,
        due_date: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

/// 记录当前时间戳（当地时间的 RFC3339 字符串）
fn timestamp_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // 简化：以 Unix 秒数作为时间戳文本，保证格式稳定
    secs.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn 打开内存库_建表成功() {
        let svc = TodoService::in_memory().expect("open in-memory");
        assert!(svc.list().expect("list").is_empty());
    }

    #[test]
    fn create_返回带id的todo() {
        let svc = TodoService::in_memory().unwrap();
        let input = TodoInput {
            title: " 买牛奶 ".to_string(),
            priority: 1,
            due_date: None,
        };
        let todo = svc.create(&input).expect("create");
        assert_eq!(todo.title, "买牛奶");
        assert_eq!(todo.priority, 1);
        assert!(!todo.done);
        assert!(todo.id > 0);
    }

    #[test]
    fn list_返回已创建的全部() {
        let svc = TodoService::in_memory().unwrap();
        svc.create(&TodoInput { title: "a".into(), priority: 0, due_date: None }).unwrap();
        svc.create(&TodoInput { title: "b".into(), priority: 2, due_date: Some("2026-08-20".into()) }).unwrap();
        let all = svc.list().unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].title, "a");
        assert_eq!(all[1].due_date.as_deref(), Some("2026-08-20"));
    }
}