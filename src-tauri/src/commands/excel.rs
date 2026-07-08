use crate::error::AppError;
use crate::models::PreviewRow;
use crate::services::excel_service;
use tauri::command;

/// 将报销单预览行导出为 .xlsx 文件
#[command]
pub async fn export_excel(
    preview_rows: Vec<PreviewRow>,
    output_path: String,
) -> Result<(), AppError> {
    excel_service::export_excel(&preview_rows, &output_path)
}
