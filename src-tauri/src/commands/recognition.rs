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
                recognition_service::detect_invoice_type(page_text, &qr_codes, &rules, None);
            let fields = recognition_service::extract_fields(
                page_text,
                &invoice_type,
                from_qr,
                &qr_codes,
                &rules,
                None,
            );

            let record = recognition_service::build_invoice_record(
                &fields,
                &invoice_type,
                &filename,
                path,
                *page_num,
            );

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

/// 从纯文本识别单据：图片 OCR 走 PaddleOCR.js 得到文本后调用本命令，
/// 复用现有 detect_invoice_type / extract_fields 业务解析（docs/LOCAL_OCR_SPEC.md §19）。
/// 图片不做二维码识别（§7.2），qr_codes 传空。
/// image_hint 可选——前端从 App 订单列表截图中预先抽出的订单号/末行金额，
/// 用于补强：订单号前缀直接告知类型（DC=car/DF=flight/DH=hotel），末行金额补强文本提取。
#[command]
pub fn recognize_from_text(
    text: String,
    filename: String,
    full_path: String,
    page_number: u32,
    image_hint: Option<recognition_service::ImageHint>,
) -> Result<InvoiceRecord, AppError> {
    let rules = RulesConfig::load().map_err(AppError::RulesLoad)?;
    let qr_codes: Vec<String> = vec![];

    // 终端打印订单号 + 金额，便于调试可见
    if let Some(h) = image_hint.as_ref() {
        tracing::info!(
            "[image-ocr] 文件={} 订单号={} 类型提示={} 金额提示={:?}",
            filename,
            h.order_id.as_deref().unwrap_or("(none)"),
            h.order_type.as_deref().unwrap_or("(none)"),
            h.amount,
        );
    }

    let (invoice_type, from_qr) = recognition_service::detect_invoice_type(
        &text,
        &qr_codes,
        &rules,
        image_hint.as_ref(),
    );
    let fields = recognition_service::extract_fields(
        &text,
        &invoice_type,
        from_qr,
        &qr_codes,
        &rules,
        image_hint.as_ref(),
    );

    // 识别完成后打印最终结果
    let amount = fields.get("amount").and_then(|v| v.as_f64());
    tracing::info!(
        "[image-ocr] 识别完成 文件={} 类型={} 金额={:?}",
        filename,
        invoice_type,
        amount,
    );

    Ok(recognition_service::build_invoice_record(
        &fields,
        &invoice_type,
        &filename,
        &full_path,
        page_number,
    ))
}

/// 读取图片字节：前端 ImageRecognitionService 需要 File 对象喂给 PaddleOCR.js，
/// Tauri WebView 无法直接访问本地文件系统，通过此命令读字节返回。
/// ponytail: 不引入 tauri-plugin-fs，单命令够用。Vec<u8> 经 Tauri 序列化为 number[]。
#[command]
pub fn read_image_bytes(path: String) -> Result<Vec<u8>, AppError> {
    std::fs::read(&path)
        .map_err(|e| AppError::PdfParse(format!("读取图片失败: {e}")))
}