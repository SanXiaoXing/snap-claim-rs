use crate::error::AppError;
use crate::models::PreviewRow;
use rust_xlsxwriter::{Format, Workbook};
use serde_json::Value;

// ponytail: 表头与前端 Panels.tsx 的 9 列严格对齐，单一真相源在此副本——
// 改列时需同步前端，否则表格与导出会错位。
const HEADERS: [&str; 9] = [
    "出发地点",
    "到达地点",
    "交通金额",
    "飞机票",
    "住宿",
    "市内交通",
    "补助标准",
    "出差天数",
    "合计",
];

/// 将报销单预览行导出为 .xlsx：表头加粗 + 合计行(bold=true)加粗，列宽固定防中文截断
pub fn export_excel(rows: &[PreviewRow], output: &str) -> Result<(), AppError> {
    let mut wb = Workbook::new();
    let ws = wb
        .add_worksheet()
        .set_name("报销单")
        .map_err(|e| AppError::ExcelExport(e.to_string()))?;

    let bold = Format::new().set_bold();

    // 表头
    for (col, h) in HEADERS.iter().enumerate() {
        ws.write_with_format(0, col as u16, *h, &bold)
            .map_err(|e| AppError::ExcelExport(e.to_string()))?;
    }
    // 固定列宽，防止「市内交通」等中文表头被截断
    for col in 0..HEADERS.len() as u16 {
        ws.set_column_width(col, 12)
            .map_err(|e| AppError::ExcelExport(e.to_string()))?;
    }

    // 数据行
    for (ri, row) in rows.iter().enumerate() {
        let r = (ri + 1) as u32; // 表头占第 0 行
        let fmt = if row.bold { Some(&bold) } else { None };
        for (col, cell) in row.cells.iter().enumerate() {
            write_cell(ws, r, col as u16, cell, fmt)?;
        }
    }

    wb.save(output)
        .map_err(|e| AppError::ExcelExport(format!("保存失败: {e}")))?;
    Ok(())
}

// ponytail: serde_json::Value → Excel 单元格：串→string，数→number，其余→空串
fn write_cell(
    ws: &mut rust_xlsxwriter::Worksheet,
    row: u32,
    col: u16,
    cell: &Value,
    fmt: Option<&Format>,
) -> Result<(), AppError> {
    let res: Result<(), rust_xlsxwriter::XlsxError> = (|| {
        if let Some(s) = cell.as_str() {
            match fmt {
                Some(f) => {
                    ws.write_with_format(row, col, s, f)?;
                }
                None => {
                    ws.write_string(row, col, s)?;
                }
            }
        } else if let Some(n) = cell.as_f64() {
            match fmt {
                Some(f) => {
                    ws.write_with_format(row, col, n, f)?;
                }
                None => {
                    ws.write_number(row, col, n)?;
                }
            }
        } else {
            ws.write_string(row, col, "")?;
        }
        Ok(())
    })();
    res.map_err(|e| AppError::ExcelExport(e.to_string()))
}
