use crate::models::InvoiceRecord;
use std::collections::HashMap;

const TYPE_MAP: &[(&str, &str)] = &[
    ("train", "高铁票"),
    ("hotel", "酒店住宿"),
    ("car", "市内用车"),
    ("flight", "飞机票"),
    ("invoice", "发票"),
    ("unknown", "未知"),
];

pub fn type_label(kind: &str) -> &'static str {
    TYPE_MAP
        .iter()
        .find(|&&(k, _)| k == kind)
        .map(|&(_, v)| v)
        .unwrap_or("未知")
}

/// 格式化识别结果行，返回前端可直接展示的字段
pub fn format_result_row(result: &InvoiceRecord) -> HashMap<String, String> {
    let mut row = HashMap::new();

    row.insert("type_label".into(), type_label(&result.kind).into());

    // 名称/车次
    let name = result
        .train_number
        .clone()
        .or_else(|| result.hotel_name.clone())
        .or_else(|| result.flight_number.clone())
        .unwrap_or_else(|| result.filename.clone());
    row.insert("name".into(), name);

    // 日期/时间
    let date = result
        .departure_time
        .clone()
        .or_else(|| result.check_in_date.clone())
        .or_else(|| result.flight_date.clone())
        .or_else(|| result.car_date.clone())
        .unwrap_or_default();
    row.insert("date".into(), date);

    // 金额
    let amount = match result.amount {
        Some(a) => format!("¥{:.2}", a),
        None => "-".into(),
    };
    row.insert("amount".into(), amount);

    // 状态
    let (status, color) = if result.amount.is_some() {
        ("已识别", "#047857")
    } else {
        ("未识别金额", "#b45309")
    };
    row.insert("status".into(), status.into());
    row.insert("status_color".into(), color.into());

    row
}