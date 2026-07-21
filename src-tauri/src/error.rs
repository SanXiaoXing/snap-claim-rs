use serde::Serialize;

#[derive(Debug, thiserror::Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum AppError {
    #[error("PDF 解析失败: {0}")]
    #[serde(rename = "PdfParse")]
    PdfParse(String),
    #[error("二维码识别失败: {0}")]
    #[serde(rename = "QrRead")]
    QrRead(String),
    #[error("IO 错误: {0}")]
    #[serde(rename = "IO")]
    Io(String),
    #[error("规则加载失败: {0}")]
    #[serde(rename = "RulesLoad")]
    RulesLoad(String),
    #[error("Excel 导出失败: {0}")]
    #[serde(rename = "ExcelExport")]
    ExcelExport(String),
    #[error("更新检查失败: {0}")]
    #[serde(rename = "Updater")]
    Updater(String),
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        Self::Io(e.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        Self::Io(e.to_string())
    }
}