use crate::config::RulesConfig;
use crate::models::InvoiceRecord;
use regex::Regex;
use serde::Deserialize;
use std::collections::HashMap;

/// 图片识别时由前端传入的提示信息（App 订单列表截图：订单号前缀即类型，末行金额即金额）。
/// 仅当 `recognize_from_text` 收到时生效，PDF 路径不传。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageHint {
    /// 前端从订单号推断的类型："car" / "flight" / "hotel"
    pub order_type: Option<String>,
    /// 订单号本体（DC/DF/DH + 数字），仅记录/调试用
    #[allow(dead_code)]
    pub order_id: Option<String>,
    /// 末行 ¥xxx.xx 金额（OCR 文本提取不到时由前端补强）
    pub amount: Option<f64>,
}

/// 判断发票类型
///
/// 决策流程：
/// 1. `image_hint` 提供了 `order_type` → 直接采用（订单号前缀 DC/DF/DH 最权威）
/// 2. 文本含「确认函」→ 扫描二维码获取具体类型（etrip://=机票, etripHotel://=酒店, etripCar://=用车）
/// 3. 文本不含「确认函」→ 按固定顺序匹配文本关键词（train, flight, hotel, car, invoice）
///
/// 返回 (type, from_qr)
pub fn detect_invoice_type(
    text: &str,
    qr_codes: &[String],
    rules: &RulesConfig,
    image_hint: Option<&ImageHint>,
) -> (String, bool) {
    // ponytail: 图片识别优先——订单号前缀比文本关键词更准，避免「酒店」误匹配到「酒店预订人」之类。
    if let Some(hint) = image_hint {
        if let Some(kind) = &hint.order_type {
            tracing::info!("[detect] image_hint 订单号 → {kind}");
            return (kind.clone(), false);
        }
    }

    let is_confirmation = text.contains("确认函");

    if is_confirmation {
        tracing::info!("[detect] 检测到确认函，通过二维码区分类型");
        // 确认函：根据二维码协议头区分机票/酒店/用车
        for qr in qr_codes {
            if qr.starts_with("etripCar://") {
                tracing::info!("[detect] 二维码 → 用车");
                return ("car".into(), true);
            } else if qr.starts_with("etripHotel://") {
                tracing::info!("[detect] 二维码 → 酒店");
                return ("hotel".into(), true);
            } else if qr.starts_with("etrip://") {
                tracing::info!("[detect] 二维码 → 机票");
                return ("flight".into(), true);
            }
        }
        // 确认函但没扫到二维码，回退到文本关键词
        tracing::warn!("[detect] 确认函未找到二维码，回退文本关键词");
    }

    // 非确认函（或确认函无二维码回退）：按固定顺序匹配关键词
    let type_order = ["train", "flight", "hotel", "car", "invoice"];
    for kind in &type_order {
        if let Some(config) = rules.invoice_types.get(*kind) {
            for keyword in &config.keywords {
                if text.contains(keyword) {
                    tracing::info!("[detect] 关键词匹配: {kind}, {keyword}");
                    return (kind.to_string(), false);
                }
            }
        }
    }

    tracing::warn!("[detect] 未能识别发票类型");
    ("unknown".into(), false)
}

/// 根据发票类型提取关键字段
pub fn extract_fields(
    text: &str,
    invoice_type: &str,
    from_qr: bool,
    qr_codes: &[String],
    rules: &RulesConfig,
    image_hint: Option<&ImageHint>,
) -> HashMap<String, serde_json::Value> {
    use serde_json::{json, Value};

    let mut result: HashMap<String, Value> = HashMap::new();
    result.insert("type".into(), json!(invoice_type));

    let Some(type_config) = rules.invoice_types.get(invoice_type) else {
        return result;
    };

    for (field_name, patterns) in &type_config.patterns {
        for pattern in patterns {
            if let Ok(re) = Regex::new(pattern) {
                if let Some(caps) = re.captures(text) {
                    if field_name == "departure_time" && caps.len() == 5 {
                        // 特殊处理：2024年01月15日 08:30开 → 2024-01-15 08:30
                        let val = format!(
                            "{}-{}-{} {}",
                            &caps[1], &caps[2], &caps[3], &caps[4]
                        );
                        result.insert(field_name.clone(), json!(val));
                    } else if field_name == "departure_time" && caps.len() == 4 {
                        // 3 组格式：2026年05月25日 → 2026-05-25（新式铁路电子客票，
                        // 日期与时间常被 pdfium 拆到不同行，这里只取日期部分）
                        let val = format!("{}-{}-{}", &caps[1], &caps[2], &caps[3]);
                        result.insert(field_name.clone(), json!(val));
                    } else if let Some(m) = caps.get(1) {
                        let val = m.as_str().trim().to_string();
                        // 尝试解析数字字段
                        if matches!(field_name.as_str(), "nights") {
                            if let Ok(n) = val.parse::<u32>() {
                                result.insert(field_name.clone(), json!(n));
                            }
                        } else if field_name == "mileage" {
                            if let Ok(n) = val.parse::<f64>() {
                                result.insert(field_name.clone(), json!(n));
                            }
                        } else {
                            result.insert(field_name.clone(), json!(val));
                        }
                    }
                    break;
                }
            }
        }
    }

    // 火车票特殊处理：提取出发站/到达站/车次
    // 同时兼容老式报销凭证（站名/车次/站名三行）与新式铁路电子客票
    // （站名车次同行 / 两站名同行 + 独立车次行）
    if invoice_type == "train" {
        if let Some((depart, train_num, arrival)) = extract_train_stations_and_number(text) {
            result.insert("departure_station".into(), json!(depart));
            result.insert("arrival_station".into(), json!(arrival));
            if !train_num.is_empty() {
                result.insert("train_number".into(), json!(train_num));
            }
        }
    }

    // 金额提取：优先级 QR > image_hint（末行）> 文本正则
    let qr_amount = if from_qr {
        extract_amount_from_qr(qr_codes, invoice_type)
    } else {
        None
    };

    if let Some(amount) = qr_amount {
        result.insert("amount".into(), json!(amount));
        result.insert("qrAmount".into(), json!(true));
        tracing::info!("[extract] 从二维码提取金额: {amount} ({invoice_type})");
    } else if let Some(hint_amount) = image_hint.and_then(|h| h.amount) {
        // ponytail: 末行 ¥xxx.xx 优先于文本正则——App 订单列表截图的金额位置固定，
        // 文本正则（"价税合计"等）匹配不到。仍走非 QR 路径，不标 qrAmount。
        result.insert("amount".into(), json!(hint_amount));
        result.insert("qrAmount".into(), json!(false));
        tracing::info!("[extract] 从 image_hint 末行提取金额: {hint_amount} ({invoice_type})");
    } else {
        let text_amount = extract_amount(text);
        if let Some(amount) = text_amount {
            result.insert("amount".into(), json!(amount));
            result.insert("qrAmount".into(), json!(false));
            tracing::info!("[extract] 从文本提取金额: {amount} ({invoice_type})");
        } else {
            tracing::warn!("[extract] 未能提取金额 ({invoice_type})");
        }
    }

    result
}

/// 从已提取字段构建 InvoiceRecord。PDF 逐页识别与图片 OCR 文本识别共用。
/// 图片输入无二维码（docs/LOCAL_OCR_SPEC.md §7.2），qr_codes 传空即可。
pub fn build_invoice_record(
    fields: &HashMap<String, serde_json::Value>,
    invoice_type: &str,
    filename: &str,
    full_path: &str,
    page_number: u32,
) -> InvoiceRecord {
    InvoiceRecord {
        kind: invoice_type.to_string(),
        amount: fields.get("amount").and_then(|v| v.as_f64()),
        qr_amount: fields
            .get("qrAmount")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        filename: filename.to_string(),
        full_path: full_path.to_string(),
        page_number,
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
        // ponytail: 新建 car 记录默认市内交通，由前端批量分类弹窗改 is_round_trip
        is_round_trip: false,
    }
}

/// 从二维码内容中提取同程商旅用车/住宿/飞机金额
///
/// 二维码格式示例：
/// - `etripCar://745322,xxx,DC260623184746145505,68.26`
/// - `etripHotel://870667,xxx,2485235576652567552,3261.0`
/// - `etrip://2888257761,xxx,318.0,2317.0`
///
/// 规则：
/// - 用车/住宿：最后一个逗号后的字段即为金额
/// - 飞机：第 3 个字段（索引 2）即为票面金额
fn extract_amount_from_qr(qr_codes: &[String], invoice_type: &str) -> Option<f64> {
    let prefix = match invoice_type {
        "car" => "etripCar://",
        "hotel" => "etripHotel://",
        "flight" => "etrip://",
        _ => return None,
    };

    for qr_data in qr_codes {
        if !qr_data.starts_with(prefix) {
            continue;
        }

        let payload = &qr_data[prefix.len()..];
        let parts: Vec<&str> = payload.split(',').collect();

        if parts.len() < 4 {
            continue;
        }

        if let Ok(amount) = if invoice_type == "flight" {
            // 飞机：第 3 个字段为金额
            parts[2].parse::<f64>()
        } else {
            // 用车/住宿：最后一个字段为金额
            parts.last()?.parse::<f64>()
        } {
            return Some(amount);
        }
    }

    None
}

/// 提取火车票的出发站/车次/到达站
///
/// 兼容 pdfium 抽取出的三种文本排列：
///
/// 1. **新式铁路电子客票 — 站名车次同行**（如第4页）：
///    ```text
///    西安北站 G368 北京西站
///    ```
///    用正则 `站\s+车次\s+站` 一次捕获三段。
///
/// 2. **新式铁路电子客票 — 两站名同行 + 独立车次行**（如第2页）：
///    ```text
///    G323
///    ...
///    北京西站 西安北站
///    ```
///    用正则 `站\s+站` 捕获两站，再在全文找独立车次行。
///
/// 3. **老式报销凭证 — 站名/车次/站名三行**：
///    ```text
///    北京西站
///    G323
///    西安北站
///    ```
///    逐行找 `^[A-Z]\d+$` 的车次行，取前后各一行。
///
/// 返回 `(departure_station, train_number, arrival_station)`，车次可能为空字符串。
fn extract_train_stations_and_number(text: &str) -> Option<(String, String, String)> {
    // 站名片段：2~8 个汉字 + "站" 字
    const STATION: &str = r"[\u4e00-\u9fa5]{2,8}站";
    // 车次：单字母(G/D/C/K/T/Z) + 1~5 位数字
    const TRAIN: &str = r"[A-Z]\d{1,5}";

    // 策略1：站名 车次 站名 同行 —— "西安北站 G368 北京西站"
    let re_inline = Regex::new(&format!("({STATION})\\s+({TRAIN})\\s+({STATION})")).ok()?;
    if let Some(caps) = re_inline.captures(text) {
        let d = caps[1].to_string();
        let t = caps[2].to_string();
        let a = caps[3].to_string();
        tracing::info!("[train] 策略1(同行) 出发={d}, 车次={t}, 到达={a}");
        return Some((d, t, a));
    }

    // 策略2：两站名同行 —— "北京西站 西安北站"，车次另找
    let re_two = Regex::new(&format!("({STATION})\\s+({STATION})")).ok()?;
    if let Some(caps) = re_two.captures(text) {
        let d = caps[1].to_string();
        let a = caps[2].to_string();
        // 排除"购买方名称:XX站段公司"这类——要求两段都是纯站名、行内无公司/发票等关键词
        let matched = caps[0].to_string();
        if !looks_like_non_station(&matched) {
            // 在全文找独立车次行（如 "G323"）
            let train_re = Regex::new(r"(?m)^\s*([A-Z]\d{1,5})\s*$").ok()?;
            let train = train_re
                .captures(text)
                .map(|c| c[1].to_string())
                .unwrap_or_default();
            tracing::info!("[train] 策略2(两站名) 出发={d}, 车次={train}, 到达={a}");
            return Some((d, train, a));
        }
    }

    // 策略3：老式 —— 站名/车次/站名 三行
    extract_train_stations_legacy(text)
}

/// 老式火车票报销凭证：站名/车次/站名 三行解析
fn extract_train_stations_legacy(text: &str) -> Option<(String, String, String)> {
    let train_re = Regex::new(r"(?m)^\s*([A-Z]\d{1,5})\s*$").ok()?;

    let lines: Vec<&str> = text
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect();

    for (i, line) in lines.iter().enumerate() {
        let train_number = match train_re.captures(line) {
            Some(c) => c[1].to_string(),
            None => continue,
        };

        // 出发站：车次行的前一行，需要包含"站"字
        let departure = if i > 0 {
            let prev = lines[i - 1];
            if prev.contains('站')
                && prev.chars().count() <= 12
                && !looks_like_non_station(prev)
            {
                Some(prev.to_string())
            } else {
                None
            }
        } else {
            None
        };

        // 到达站：车次行的后一行，需要包含"站"字
        let arrival = if i + 1 < lines.len() {
            let next = lines[i + 1];
            if next.contains('站')
                && next.chars().count() <= 12
                && !looks_like_non_station(next)
            {
                Some(next.to_string())
            } else {
                None
            }
        } else {
            None
        };

        if let (Some(d), Some(a)) = (departure, arrival) {
            tracing::info!("[train] 策略3(三行) 出发={d}, 车次={train_number}, 到达={a}");
            return Some((d, train_number, a));
        }
    }

    None
}

/// 判断某段文本是否不像火车站名
///
/// 真实站名是地理名称（如"北京西站"、"上海虹桥站"），不会包含
/// 公司/单位/发票等关键词。命中这些关键词则视为非站点文本（如
/// "购买方名称:XX站段公司"），避免被误识别为出发/到达站。
fn looks_like_non_station(s: &str) -> bool {
    [
        "公司", "集团", "单位", "发票", "报销", "购买", "销售", "开票", "车次", "日期", "票号",
        "增值税", "税务", "信用代码",
    ]
    .iter()
    .any(|k| s.contains(k))
}

/// 从文本中提取金额
pub fn extract_amount(text: &str) -> Option<f64> {
    let patterns = [
        r"价税合计[：:]?\s*([\d.]+)元?",
        r"实付金额[：:]?\s*([\d.]+)",
        r"费用合计[：:]?\s*([\d.]+)",
        r"合+计+[：:]?\s*([\d.]+)(?:\s+\d+\s+\d+\s+([\d.]+))?",
        r"金额[：:]?\s*([\d.]+)元?",
        r"[￥¥]\s*([\d.]+)",
        r"总金额[：:]?\s*([\d.]+)",
        r"订单金额[：:]?\s*([\d.]+)",
    ];

    for pattern in &patterns {
        if let Ok(re) = Regex::new(pattern) {
            if let Some(caps) = re.captures(text) {
                // ponytail: SubCaptureMatches 不支持 rev，先收集再逆向遍历
                let groups: Vec<Option<regex::Match<'_>>> = caps.iter().collect();
                for g in groups.iter().rev() {
                    if let Some(m) = g {
                        if let Ok(val) = m.as_str().parse::<f64>() {
                            return Some(val);
                        }
                    }
                }
            }
        }
    }

    None
}