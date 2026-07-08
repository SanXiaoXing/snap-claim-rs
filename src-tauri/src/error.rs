use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum AppError {
    #[serde(rename = "PdfParse")]
    PdfParse(String),
    #[serde(rename = "QrRead")]
    QrRead(String),
    #[serde(rename = "IO")]
    Io(String),
    #[serde(rename = "RulesLoad")]
    RulesLoad(String),
    #[serde(rename = "ExcelExport")]
    ExcelExport(String),
    #[serde(rename = "Cancelled")]
    Cancelled,
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::PdfParse(s) => write!(f, "PDF 解析失败: {s}"),
            Self::QrRead(s) => write!(f, "二维码识别失败: {s}"),
            Self::Io(s) => write!(f, "IO 错误: {s}"),
            Self::RulesLoad(s) => write!(f, "规则加载失败: {s}"),
            Self::ExcelExport(s) => write!(f, "Excel 导出失败: {s}"),
            Self::Cancelled => write!(f, "任务取消"),
        }
    }
}

impl std::error::Error for AppError {}

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