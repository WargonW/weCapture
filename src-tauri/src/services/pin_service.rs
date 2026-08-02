use std::collections::HashMap;
use std::sync::Mutex;

/// 全局贴图数据缓存：label -> data URL
/// 用于截图窗口向贴图窗口传递图片数据（同一 Tauri 进程内共享）
static PIN_CACHE: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);

/// 获取缓存的可变引用（懒初始化）
fn cache() -> std::sync::MutexGuard<'static, Option<HashMap<String, String>>> {
    let mut guard = PIN_CACHE.lock().expect("PIN_CACHE 锁中毒");
    if guard.is_none() {
        *guard = Some(HashMap::new());
    }
    guard
}

/// 暂存贴图数据（截图窗口创建贴图窗口前调用）
pub fn stash(label: &str, data_url: &str) {
    let mut g = cache();
    g.as_mut().unwrap().insert(label.to_string(), data_url.to_string());
}

/// 取出并删除贴图数据（贴图窗口启动时调用）
/// 返回 None 表示数据不存在或已被取走
pub fn take(label: &str) -> Option<String> {
    let mut g = cache();
    g.as_mut().unwrap().remove(label)
}

/// 清空所有缓存（测试与清理用）
pub fn clear() {
    let mut g = cache();
    g.as_mut().unwrap().clear();
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reset() {
        clear();
    }

    #[test]
    fn test_stash_and_take() {
        reset();
        stash("pin-1", "data:image/png;base64,AAA");
        let v = take("pin-1");
        assert_eq!(v.as_deref(), Some("data:image/png;base64,AAA"));
    }

    #[test]
    fn test_take_removes_entry() {
        reset();
        stash("pin-2", "data:url");
        let _ = take("pin-2");
        // 第二次取应返回 None
        assert_eq!(take("pin-2"), None);
    }

    #[test]
    fn test_take_nonexistent_returns_none() {
        reset();
        assert_eq!(take("not-exist"), None);
    }

    #[test]
    fn test_multiple_entries_independent() {
        reset();
        stash("pin-a", "url-a");
        stash("pin-b", "url-b");
        assert_eq!(take("pin-a").as_deref(), Some("url-a"));
        assert_eq!(take("pin-b").as_deref(), Some("url-b"));
    }

    #[test]
    fn test_overwrite_existing() {
        reset();
        stash("pin-3", "old");
        stash("pin-3", "new");
        assert_eq!(take("pin-3").as_deref(), Some("new"));
    }

    #[test]
    fn test_clear() {
        reset();
        stash("pin-4", "x");
        clear();
        assert_eq!(take("pin-4"), None);
    }
}
