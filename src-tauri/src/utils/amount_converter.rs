const DIGIT_MAP: [&str; 10] = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
const UNIT_MAP: [&str; 9] = ["元", "拾", "佰", "仟", "万", "拾", "佰", "仟", "亿"];
const DECIMAL_UNIT: [&str; 2] = ["角", "分"];

pub fn convert(amount: f64) -> String {
    if amount < 0.0 {
        return "金额不能为负数".to_string();
    }
    if amount == 0.0 {
        return "零元整".to_string();
    }

    let amount_str = format!("{:.2}", amount);
    let parts: Vec<&str> = amount_str.split('.').collect();
    let integer_part = parts[0];
    let decimal_part = parts[1];

    let integer_chinese = convert_integer(integer_part);
    let decimal_chinese = convert_decimal(decimal_part);

    if decimal_chinese.is_empty() {
        format!("{integer_chinese}整")
    } else {
        format!("{integer_chinese}{decimal_chinese}")
    }
}

fn convert_integer(integer_str: &str) -> String {
    let mut result = String::new();
    let chars: Vec<char> = integer_str.chars().collect();
    let length = chars.len();

    for (i, &ch) in chars.iter().enumerate() {
        let pos = length - 1 - i;
        let unit = UNIT_MAP[pos % UNIT_MAP.len()];
        let digit = ch.to_digit(10).unwrap_or(0) as usize;

        if digit == 0 {
            if !result.ends_with('零') {
                result.push('零');
            }
        } else {
            if result.ends_with('零') && i > 0 {
                result.pop();
            }
            result.push_str(DIGIT_MAP[digit]);
            result.push_str(unit);
        }
    }

    while result.ends_with('零') {
        result.pop();
    }

    result
}

fn convert_decimal(decimal_str: &str) -> String {
    let mut result = String::new();
    let chars: Vec<char> = decimal_str.chars().collect();

    if chars[0] != '0' {
        let digit = chars[0].to_digit(10).unwrap_or(0) as usize;
        result.push_str(DIGIT_MAP[digit]);
        result.push_str(DECIMAL_UNIT[0]);
    }
    if chars[1] != '0' {
        let digit = chars[1].to_digit(10).unwrap_or(0) as usize;
        result.push_str(DIGIT_MAP[digit]);
        result.push_str(DECIMAL_UNIT[1]);
    }

    result
}