use crate::error::AppError;
use pdfium_render::prelude::*;
use std::path::Path;

/// 初始化 pdfium，依次尝试多个路径加载 pdfium.dll
fn init_pdfium() -> Result<Pdfium, AppError> {
    let paths = &["./", "./src-tauri/", "../"];
    for dir in paths {
        if let Ok(binder) = Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path(dir)) {
            return Ok(Pdfium::new(binder));
        }
    }
    Pdfium::bind_to_system_library()
        .map(Pdfium::new)
        .map_err(|e| AppError::PdfParse(format!("无法加载 pdfium: {e}")))
}

/// 从 PDF 文件中按页提取文本
pub fn extract_text_by_page(path: &str) -> Result<Vec<(u32, String)>, AppError> {
    let path = Path::new(path);
    if !path.exists() {
        return Err(AppError::PdfParse(format!("文件不存在: {}", path.display())));
    }

    let pdfium = init_pdfium()?;
    let doc = pdfium
        .load_pdf_from_file(path, None)
        .map_err(|e| AppError::PdfParse(format!("无法打开 PDF: {e}")))?;

    let mut pages = Vec::new();

    for (i, page) in doc.pages().iter().enumerate() {
        let page_num = (i + 1) as u32;
        let page_text = page.text().map(|t| t.all()).unwrap_or_default();
        let trimmed = page_text.trim().to_string();
        if !trimmed.is_empty() {
            pages.push((page_num, trimmed));
        }
    }

    Ok(pages)
}

/// 从 PDF 页面中扫描二维码，返回 (page_number, [qrcode_data, ...])
pub fn extract_qr_codes(path: &str) -> Result<Vec<(u32, Vec<String>)>, AppError> {
    let path = Path::new(path);
    if !path.exists() {
        return Err(AppError::QrRead(format!("文件不存在: {}", path.display())));
    }

    let pdfium = init_pdfium()?;
    let doc = pdfium
        .load_pdf_from_file(path, None)
        .map_err(|e| AppError::QrRead(format!("无法打开 PDF: {e}")))?;

    let mut results = Vec::new();

    for (i, page) in doc.pages().iter().enumerate() {
        let page_num = (i + 1) as u32;

        // 尝试多种分辨率渲染，提高二维码检出率
        let qr_list = scan_page_for_qr(&page, page_num);
        results.push((page_num, qr_list));
    }

    Ok(results)
}

/// 对单页尝试多种分辨率渲染并扫描二维码
fn scan_page_for_qr(page: &PdfPage, page_num: u32) -> Vec<String> {
    // 依次尝试 3000, 2000, 4000 像素宽度
    for width in [3000u16, 2000u16, 4000u16] {
        let render_result = page.render_with_config(
            &PdfRenderConfig::new()
                .set_target_width(width as i32)
                .set_clear_color(PdfColor::WHITE),
        );

        match render_result {
            Ok(bitmap) => {
                let rgba = bitmap.as_rgba_bytes();
                let w = bitmap.width() as u32;
                let h = bitmap.height() as u32;

                match scan_qr_from_rgba(&rgba, w, h) {
                    Ok(qr) if !qr.is_empty() => {
                        tracing::info!("第 {page_num} 页在 {width}px 宽度下找到 {len} 个二维码", len = qr.len());
                        return qr;
                    }
                    _ => continue,
                }
            }
            Err(e) => {
                tracing::warn!("第 {page_num} 页 {width}px 渲染失败: {e}");
            }
        }
    }

    Vec::new()
}

/// 从 RGBA 字节数组中扫描二维码（转为灰度图提高检出率）
fn scan_qr_from_rgba(rgba: &[u8], width: u32, height: u32) -> Result<Vec<String>, String> {
    use rxing::{
        common::HybridBinarizer,
        BarcodeFormat, DecodingHintDictionary, MultiFormatReader, Reader,
    };
    use rxing::BinaryBitmap;
    use rxing::Luma8LuminanceSource;
    use std::collections::HashSet;

    // RGBA → 灰度 (Luma8)，取 R 通道近似（QR 码通常是黑白的）
    let gray: Vec<u8> = rgba
        .chunks_exact(4)
        .map(|p| ((p[0] as u16 + p[1] as u16 + p[2] as u16) / 3) as u8)
        .collect();

    let mut hints = DecodingHintDictionary::new();
    let mut formats = HashSet::new();
    formats.insert(BarcodeFormat::QR_CODE);
    hints.insert(
        rxing::DecodeHintType::POSSIBLE_FORMATS,
        rxing::DecodeHintValue::PossibleFormats(formats),
    );
    // 尝试多种二值化策略
    hints.insert(
        rxing::DecodeHintType::TRY_HARDER,
        rxing::DecodeHintValue::TryHarder(true),
    );

    let source = Luma8LuminanceSource::new(gray, width, height);
    let mut bitmap = BinaryBitmap::new(HybridBinarizer::new(source));

    let mut reader = MultiFormatReader::default();

    match reader.decode_with_hints(&mut bitmap, &hints) {
        Ok(result) => Ok(vec![result.getText().to_string()]),
        Err(_) => Ok(Vec::new()),
    }
}