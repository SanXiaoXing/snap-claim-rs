use crate::models::{InvoiceRecord, PreviewRow, Totals};
use crate::services::database::{Database, HistoryDetail, HistorySummary};
use tauri::State;

/// 保存当前识别结果到数据库
#[tauri::command]
pub async fn save_history(
    db: State<'_, Database>,
    records: Vec<InvoiceRecord>,
    totals: Totals,
    preview_rows: Vec<PreviewRow>,
    start_date: Option<String>,
    end_date: Option<String>,
    days: u32,
) -> Result<HistoryDetail, String> {
    let name = generate_name(start_date.as_deref(), end_date.as_deref());
    db.save_history(
        &name,
        &records,
        &totals,
        &preview_rows,
        start_date.as_deref(),
        end_date.as_deref(),
        days,
    )
    .map_err(|e| e.to_string())
}

/// 获取历史记录列表（按名称倒序）
#[tauri::command]
pub async fn get_history_list(db: State<'_, Database>) -> Result<Vec<HistorySummary>, String> {
    db.get_history_list().map_err(|e| e.to_string())
}

/// 获取单条历史记录完整详情
#[tauri::command]
pub async fn get_history_detail(db: State<'_, Database>, id: i64) -> Result<HistoryDetail, String> {
    db.get_history_detail(id).map_err(|e| e.to_string())
}

/// 删除指定历史记录
#[tauri::command]
pub async fn delete_history(db: State<'_, Database>, id: i64) -> Result<(), String> {
    db.delete_history(id).map_err(|e| e.to_string())
}

/// 生成记录名称：有日期区间则用 "YYYYMMDD-YYYYMMDD"，否则用当天日期
fn generate_name(start_date: Option<&str>, end_date: Option<&str>) -> String {
    match (start_date, end_date) {
        (Some(s), Some(e)) => {
            let s = s.replace('-', "");
            let e = e.replace('-', "");
            format!("{}-{}", s, e)
        }
        _ => {
            // 用当前日期 YYYYMMDD
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default();
            let secs = now.as_secs();
            let days = secs / 86400;
            let (y, m, d) = days_to_date(days);
            format!("{:04}{:02}{:02}", y, m, d)
        }
    }
}

fn days_to_date(days: u64) -> (u64, u32, u32) {
    let mut y = 1970u64;
    let mut remaining = days as i64;
    loop {
        let days_in_year = if is_leap(y) { 366 } else { 365 };
        if remaining < days_in_year {
            break;
        }
        remaining -= days_in_year;
        y += 1;
    }
    const MONTH_DAYS: &[u32] = &[31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut m = 1u32;
    for &md in MONTH_DAYS {
        let dim = if m == 2 && is_leap(y) { md + 1 } else { md };
        if (remaining as u32) < dim {
            break;
        }
        remaining -= dim as i64;
        m += 1;
    }
    let d = (remaining as u32) + 1;
    (y, m, d)
}

fn is_leap(year: u64) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}
