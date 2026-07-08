use crate::error::AppError;
use crate::services::pdf_service;
use tauri::command;

/// 合并多个 PDF 文件到指定输出路径，按入参顺序拼接
#[command]
pub async fn merge_pdfs(file_paths: Vec<String>, output_path: String) -> Result<(), AppError> {
    pdf_service::merge_pdfs(&file_paths, &output_path)
}
