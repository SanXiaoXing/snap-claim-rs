use crate::models::{InvoiceRecord, Totals, PreviewRow};
use crate::utils::amount_converter;

pub const SUBSIDY_PER_DAY: f64 = 100.0;

/// 计算费用汇总
pub fn calc_totals(results: &[InvoiceRecord], days: u32) -> Totals {
    let train = sum_by_type(results, "train");
    let flight = sum_by_type(results, "flight");
    let hotel = sum_by_type(results, "hotel");
    let car = sum_by_type(results, "car");
    let invoice = sum_by_type(results, "invoice");

    let subsidy = days as f64 * SUBSIDY_PER_DAY;
    let advance = car + flight + hotel;
    let refund = train + subsidy;
    let total = train + flight + hotel + car + invoice + subsidy;
    let chinese = amount_converter::convert(total);

    Totals {
        train,
        flight,
        hotel,
        car,
        invoice,
        subsidy,
        advance,
        refund,
        total,
        chinese,
    }
}

/// 构建报销单预览行数据
pub fn build_preview_rows(results: &[InvoiceRecord], days: u32) -> Vec<PreviewRow> {
    let train_data: Vec<_> = results.iter().filter(|r| r.kind == "train").collect();
    let flight_data: Vec<_> = results.iter().filter(|r| r.kind == "flight").collect();
    let hotel_data: Vec<_> = results.iter().filter(|r| r.kind == "hotel").collect();
    let car_data: Vec<_> = results.iter().filter(|r| r.kind == "car").collect();
    let invoice_data: Vec<_> = results.iter().filter(|r| r.kind == "invoice").collect();

    let train_total = sum_records(&train_data);
    let flight_total = sum_records(&flight_data);
    let hotel_total = sum_records(&hotel_data);
    let car_total = sum_records(&car_data);
    let invoice_total = sum_records(&invoice_data);

    let subsidy_total = days as f64 * SUBSIDY_PER_DAY;
    let mut rows = Vec::new();

    use serde_json::{json, Value};
    let j = |v: &str| -> Value { json!(v) };
    let n = |v: f64| -> Value { json!(v) };
    let e = || -> Value { json!("") };
    let i = |v: u32| -> Value { json!(v) };

    // 高铁票行
    for train in &train_data {
        let amount = train.amount.unwrap_or(0.0);
        rows.push(PreviewRow {
            cells: vec![
                j(train.departure_station.as_deref().unwrap_or("")),
                j(train.arrival_station.as_deref().unwrap_or("")),
                n(amount),
                e(), e(), e(), e(), e(),
                n(amount),
            ],
            bold: false,
        });
    }

    // 飞机票合计行
    if flight_total > 0.0 {
        rows.push(PreviewRow {
            cells: vec![j("飞机票"), e(), e(), n(flight_total), e(), e(), e(), e(), n(flight_total)],
            bold: false,
        });
    }

    // 住宿合计行
    if hotel_total > 0.0 {
        rows.push(PreviewRow {
            cells: vec![j("住宿"), e(), e(), e(), n(hotel_total), e(), e(), e(), n(hotel_total)],
            bold: false,
        });
    }

    // 市内交通合计行
    if car_total > 0.0 {
        rows.push(PreviewRow {
            cells: vec![j("市内交通"), e(), e(), e(), e(), n(car_total), e(), e(), n(car_total)],
            bold: false,
        });
    }

    // 其他发票行
    if invoice_total > 0.0 {
        rows.push(PreviewRow {
            cells: vec![j("其他"), e(), n(invoice_total), e(), e(), e(), e(), e(), n(invoice_total)],
            bold: false,
        });
    }

    // 出差补助行
    if subsidy_total > 0.0 {
        rows.push(PreviewRow {
            cells: vec![j("出差补助"), e(), e(), e(), e(), e(), i(SUBSIDY_PER_DAY as u32), i(days), n(subsidy_total)],
            bold: false,
        });
    }

    // 合计行
    let total_amount = train_total + flight_total + hotel_total + car_total + invoice_total + subsidy_total;
    rows.push(PreviewRow {
        cells: vec![
            j("合计"), e(),
            n(train_total + invoice_total),
            n(flight_total),
            n(hotel_total),
            n(car_total),
            e(), e(),
            n(total_amount),
        ],
        bold: true,
    });

    rows
}

fn sum_by_type(results: &[InvoiceRecord], kind: &str) -> f64 {
    results
        .iter()
        .filter(|r| r.kind == kind)
        .filter_map(|r| r.amount)
        .sum()
}

fn sum_records(records: &[&InvoiceRecord]) -> f64 {
    records.iter().filter_map(|r| r.amount).sum()
}