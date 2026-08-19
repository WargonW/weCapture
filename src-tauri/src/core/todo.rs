use serde::{Deserialize, Serialize};

/// 待办优先级：0低 / 1中 / 2高
pub type TodoPriority = i64;

/// 待办事项领域模型
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Todo {
    pub id: i64,
    pub title: String,
    pub done: bool,
    pub priority: TodoPriority,
    /// 可选截止日期，YYYY-MM-DD
    pub due_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// 新建待办输入（属性校验后入库）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoInput {
    pub title: String,
    pub priority: TodoPriority,
    pub due_date: Option<String>,
}

impl TodoInput {
    /// 校验标题必填（去空白后非空）与优先级取值范围（0-2）
    pub fn is_valid(&self) -> bool {
        !self.title.trim().is_empty()
            && (0..=2).contains(&self.priority)
    }

    /// 规范化：标题去首尾空白，空字符串的 due_date 视为 None
    pub fn normalized(&self) -> TodoInput {
        TodoInput {
            title: self.title.trim().to_string(),
            priority: self.priority,
            due_date: self
                .due_date
                .as_ref()
                .map(|d| d.trim().to_string())
                .filter(|d| !d.is_empty()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn 标题必填_空标题非法() {
        let input = TodoInput {
            title: "   ".to_string(),
            priority: 0,
            due_date: None,
        };
        assert!(!input.is_valid());
    }

    #[test]
    fn 标题非空_合法() {
        let input = TodoInput {
            title: "写周报".to_string(),
            priority: 1,
            due_date: None,
        };
        assert!(input.is_valid());
    }

    #[test]
    fn 优先级越界_非法() {
        let input = TodoInput {
            title: "task".to_string(),
            priority: 3,
            due_date: None,
        };
        assert!(!input.is_valid());
    }

    #[test]
    fn 优先级负值_非法() {
        let input = TodoInput {
            title: "task".to_string(),
            priority: -1,
            due_date: None,
        };
        assert!(!input.is_valid());
    }

    #[test]
    fn normalized_去除标题空白() {
        let input = TodoInput {
            title: "  买菜  ".to_string(),
            priority: 2,
            due_date: None,
        };
        assert_eq!(input.normalized().title, "买菜");
    }

    #[test]
    fn normalized_空due_date转为None() {
        let input = TodoInput {
            title: "task".to_string(),
            priority: 0,
            due_date: Some("  ".to_string()),
        };
        assert_eq!(input.normalized().due_date, None);
    }
}