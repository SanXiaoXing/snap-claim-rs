use crate::config::RulesConfig;
use crate::error::AppError;
use crate::models::{InvoiceRecord, RecognitionResult};
use crate::services::expense_calculator;
use crate::services::pdf_service;
use crate::services::recognition_service;
use std::collections::HashMap;
use tauri::{command, Emitter, Window};

/// 识别发票：接收文件路径列表 + 出差天数，返回完整识别结果
#[command]
pub async fn recognize_invoices(
    file_paths: Vec<String>,
    days: u32,
    existing_records: Vec<InvoiceRecord>,
    window: Window,
) -> Result<RecognitionResult, AppError> {
    let rules = RulesConfig::load().map_err(AppError::RulesLoad)?;
    let total = file_paths.len();

    // ponytail: 增量识别——已识别的记录由前端回传，后端只解析本次新增的 file_paths，
    // 再在新旧记录合并后统一重算 totals/preview，避免重复解析老 PDF。
    let mut records: Vec<InvoiceRecord> = existing_records;

    for (i, path) in file_paths.iter().enumerate() {
        let _ = window.emit(
            "recognition://progress",
            serde_json::json!({ "current": i + 1, "total": total }),
        );

        let filename = std::path::Path::new(path)
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();

        // 1. 提取 PDF 文本（按页）
        let pages = pdf_service::extract_text_by_page(path)?;

        if pages.is_empty() {
            tracing::warn!("文件无文本内容: {filename}");
            continue;
        }

        // 2. 扫描二维码（按页）
        let qr_codes_by_page = pdf_service::extract_qr_codes(path).unwrap_or_default();

        // 发送二维码扫描结果给前端
        let qr_flat: Vec<serde_json::Value> = qr_codes_by_page
            .iter()
            .filter(|(_, codes)| !codes.is_empty())
            .map(|(p, codes)| {
                serde_json::json!({ "page": p, "urls": codes, "filename": filename })
            })
            .collect();
        if !qr_flat.is_empty() {
            let _ = window.emit("recognition://qrcode", serde_json::json!(qr_flat));
        }

        let qr_map: HashMap<u32, Vec<String>> = qr_codes_by_page.into_iter().collect();

        // 3. 逐页识别
        for (page_num, page_text) in &pages {
            let qr_codes = qr_map.get(page_num).cloned().unwrap_or_default();

            // // 输出该页全文，便于调试识别规则与字段提取
            // tracing::info!(
            //     "===== {filename} 第 {page_num} 页全文（{} 字符）=====\n{}\n===== 第 {page_num} 页全文结束 =====",
            //     page_text.chars().count(),
            //     page_text
            // );

            let (invoice_type, from_qr) =
                recognition_service::detect_invoice_type(page_text, &qr_codes, &rules);
            let fields = recognition_service::extract_fields(
                page_text,
                &invoice_type,
                from_qr,
                &qr_codes,
                &rules,
            );

            let record = InvoiceRecord {
                kind: invoice_type,
                amount: fields.get("amount").and_then(|v| v.as_f64()),
                qr_amount: fields
                    .get("qrAmount")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false),
                filename: filename.clone(),
                full_path: path.clone(),
                page_number: *page_num,
                train_number: fields
                    .get("train_number")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                departure_station: fields
                    .get("departure_station")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                arrival_station: fields
                    .get("arrival_station")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                departure_time: fields
                    .get("departure_time")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                hotel_name: fields
                    .get("hotel_name")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                check_in_date: fields
                    .get("check_in_date")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                check_out_date: fields
                    .get("check_out_date")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                nights: fields.get("nights").and_then(|v| v.as_u64()).map(|n| n as u32),
                car_date: fields
                    .get("car_date")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                mileage: fields.get("mileage").and_then(|v| v.as_f64()),
                flight_number: fields
                    .get("flight_number")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                departure_city: fields
                    .get("departure_city")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                arrival_city: fields
                    .get("arrival_city")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                flight_date: fields
                    .get("flight_date")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                invoice_code: fields
                    .get("invoice_code")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                invoice_number: fields
                    .get("invoice_number")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                issue_date: fields
                    .get("issue_date")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
            };

            tracing::info!(
                "第 {page_num} 页识别: 类型={}, 金额={:?}",
                record.kind,
                record.amount
            );
            // 增量推送：识别出一条就发给前端，无需等全部跑完
            let _ = window.emit("recognition://record", &record);
            records.push(record);
        }
    }

    let totals = expense_calculator::calc_totals(&records, days);
    let preview_rows = expense_calculator::build_preview_rows(&records, days);

    let _ = window.emit(
        "recognition://progress",
        serde_json::json!({ "current": total, "total": total }),
    );

    Ok(RecognitionResult {
        records,
        totals,
        preview_rows,
    })
}