use crate::core::todo::{Todo, TodoInput};
use crate::services::todo_service::TodoService;
use tauri::State;

/// 查询全部待办
#[tauri::command]
pub fn list_todos(service: State<'_, TodoService>) -> Result<Vec<Todo>, String> {
    service
        .list()
        .map_err(|e| format!("查询待办失败: {e}"))
}

/// 新建待办（输入校验，非法返回错误）
#[tauri::command]
pub fn create_todo(
    service: State<'_, TodoService>,
    title: String,
    priority: Option<i64>,
    due_date: Option<String>,
) -> Result<Todo, String> {
    let input = TodoInput {
        title,
        priority: priority.unwrap_or(0),
        due_date,
    };
    if !input.is_valid() {
        return Err("标题不能为空, 优先级范围 0-2".to_string());
    }
    service
        .create(&input)
        .map_err(|e| format!("创建待办失败: {e}"))
}

/// 切换完成状态
#[tauri::command]
pub fn toggle_todo(
    service: State<'_, TodoService>,
    id: i64,
) -> Result<Option<Todo>, String> {
    service
        .toggle(id)
        .map_err(|e| format!("切换待办状态失败: {e}"))
}

/// 删除待办
#[tauri::command]
pub fn delete_todo(service: State<'_, TodoService>, id: i64) -> Result<bool, String> {
    service
        .delete(id)
        .map_err(|e| format!("删除待办失败: {e}"))
}

/// 更新待办（标题必填，优先级 0-2）
#[tauri::command]
pub fn update_todo(
    service: State<'_, TodoService>,
    id: i64,
    title: String,
    priority: Option<i64>,
    due_date: Option<String>,
) -> Result<Option<Todo>, String> {
    let input = TodoInput {
        title,
        priority: priority.unwrap_or(0),
        due_date,
    };
    if !input.is_valid() {
        return Err("标题不能为空, 优先级范围 0-2".to_string());
    }
    service
        .update(id, &input)
        .map_err(|e| format!("更新待办失败: {e}"))
}