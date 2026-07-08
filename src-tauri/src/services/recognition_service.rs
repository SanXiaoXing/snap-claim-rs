use crate::config::RulesConfig;
use regex::Regex;
use std::collections::HashMap;

/// 判断发票类型
///
/// 决策流程：
/// 1. 文本含「确认函」→ 扫描二维码获取具体类型（etrip://=机票, etripHotel://=酒店, etripCar://=用车）
/// 2. 文本不含「确认函」→ 按固定顺序匹配文本关键词（train, flight, hotel, car, invoice）
///
/// 返回 (type, from_qr)
pub fn detect_invoice_type(text: &str, qr_codes: &[String], rules: &RulesConfig) -> (String, bool) {
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
                        // 特殊处理：2024年01月15日 08:30开
                        let val = format!(
                            "{}-{}-{} {}",
                            &caps[1], &caps[2], &caps[3], &caps[4]
                        );
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

    // 火车票特殊处理：按行解析（出发站=车次行前一行，到达站=车次行后一行）
    if invoice_type == "train" {
        if let Some((depart, train_num, arrival)) = extract_train_stations_by_line(text) {
            result.insert("departure_station".into(), json!(depart));
            result.insert("arrival_station".into(), json!(arrival));
            result.insert("train_number".into(), json!(train_num));
        }
    }

    // 金额提取：确认函类型由 QR 确定 → 用 QR 金额；否则用文本正则
    let qr_amount = if from_qr {
        extract_amount_from_qr(qr_codes, invoice_type)
    } else {
        None
    };

    if let Some(amount) = qr_amount {
        result.insert("amount".into(), json!(amount));
        result.insert("qrAmount".into(), json!(true));
        tracing::info!("[extract] 从二维码提取金额: {amount} ({invoice_type})");
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

/// 按行解析火车票的出发站/车次/到达站
///
/// pdfium 提取的票面文本中，站名和车次通常是独立的一行：
/// ```
/// 北京西站
/// G323
/// 西安北站
/// ```
///
/// 返回 `(departure_station, train_number, arrival_station)`
fn extract_train_stations_by_line(text: &str) -> Option<(String, String, String)> {
    // 只匹配独立的车次行（整行就是一个 G/D/C 字母+数字的编号）
    let train_re = Regex::new(r"^[A-Z]\d{1,5}$").ok()?;

    let lines: Vec<&str> = text
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect();

    for (i, line) in lines.iter().enumerate() {
        if !train_re.is_match(line) {
            continue;
        }

        let train_number = line.to_string();

        // 出发站：车次行的前一行，需要包含"站"字
        let departure = if i > 0 {
            let prev = lines[i - 1];
            if prev.contains('站') && prev.chars().count() <= 12 {
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
            if next.contains('站') && next.chars().count() <= 12 {
                Some(next.to_string())
            } else {
                None
            }
        } else {
            None
        };

        if let (Some(d), Some(a)) = (departure, arrival) {
            tracing::info!("[train] 出发={d}, 车次={train_number}, 到达={a}");
            return Some((d, train_number, a));
        }
    }

    None
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