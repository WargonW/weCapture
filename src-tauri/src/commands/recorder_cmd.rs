use tauri::Manager;

use crate::core::recorder::{RecorderConfig, RecorderState};
use crate::services::recorder_service::RecorderService;

/// 开始录屏
/// - config: 录屏配置（fps + mode + region）
/// - 输出到用户 home 目录下的 snapmaster_record_{ts}.mp4
#[tauri::command]
pub fn start_recorder(
    app: tauri::AppHandle,
    state: tauri::State<'_, RecorderService>,
    config: RecorderConfig,
) -> Result<(), String> {
    let output_dir = app
        .path()
        .home_dir()
        .map_err(|e| format!("获取用户目录失败: {}", e))?;
    state.start(config, &output_dir)
}

/// 停止录屏，返回 MP4 文件路径
#[tauri::command]
pub fn stop_recorder(state: tauri::State<'_, RecorderService>) -> Result<String, String> {
    state.stop()
}

/// 取消录屏（不产生结果）
#[tauri::command]
pub fn cancel_recorder(state: tauri::State<'_, RecorderService>) -> Result<(), String> {
    state.cancel()
}

/// 查询录屏状态
#[tauri::command]
pub fn recorder_state(state: tauri::State<'_, RecorderService>) -> Result<RecorderState, String> {
    state.state()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_start_recorder_command_signature() {
        let _f: fn(
            tauri::AppHandle,
            tauri::State<'_, RecorderService>,
            RecorderConfig,
        ) -> Result<(), String> = start_recorder;
    }

    #[test]
    fn test_stop_recorder_command_signature() {
        let _f: fn(tauri::State<'_, RecorderService>) -> Result<String, String> = stop_recorder;
    }

    #[test]
    fn test_cancel_recorder_command_signature() {
        let _f: fn(tauri::State<'_, RecorderService>) -> Result<(), String> = cancel_recorder;
    }

    #[test]
    fn test_recorder_state_command_signature() {
        let _f: fn(tauri::State<'_, RecorderService>) -> Result<RecorderState, String> =
            recorder_state;
    }
}
