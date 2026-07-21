use crate::models::{InvoiceRecord, Totals, PreviewRow};
use crate::utils::amount_converter;

pub const SUBSIDY_PER_DAY: f64 = 100.0;

/// 计算费用汇总
pub fn calc_totals(results: &[InvoiceRecord], days: u32) -> Totals {
    let train = sum_amounts(results, "train");
    let flight = sum_amounts(results, "flight");
    let hotel = sum_amounts(results, "hotel");
    let invoice = sum_amounts(results, "invoice");

    // ponytail: 用车记录按 is_round_trip 拆成市内 / 往返两类。
    // 旧记录无该字段时 serde default=false，全部归市内，行为与重构前一致。
    let (car, round_trip) = results
        .iter()
        .filter(|r| r.kind == "car")
        .fold((0.0_f64, 0.0_f64), |(city, rt), r| {
            let amt = r.amount.unwrap_or(0.0);
            if r.is_round_trip { (city, rt + amt) } else { (city + amt, rt) }
        });

    let subsidy = days as f64 * SUBSIDY_PER_DAY;
    let advance = car + round_trip + flight + hotel;
    let refund = train + subsidy;
    let total = train + flight + hotel + car + round_trip + invoice + subsidy;
    let chinese = amount_converter::convert(total);

    Totals {
        train,
        flight,
        hotel,
        car,
        round_trip,
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
    let car_data: Vec<_> = results.iter().filter(|r| r.kind == "car" && !r.is_round_trip).collect();
    let round_trip_data: Vec<_> = results.iter().filter(|r| r.kind == "car" && r.is_round_trip).collect();
    let invoice_data: Vec<_> = results.iter().filter(|r| r.kind == "invoice").collect();

    let train_total: f64 = train_data.iter().filter_map(|r| r.amount).sum();
    let flight_total: f64 = flight_data.iter().filter_map(|r| r.amount).sum();
    let hotel_total: f64 = hotel_data.iter().filter_map(|r| r.amount).sum();
    let car_total: f64 = car_data.iter().filter_map(|r| r.amount).sum();
    let round_trip_total: f64 = round_trip_data.iter().filter_map(|r| r.amount).sum();
    let invoice_total: f64 = invoice_data.iter().filter_map(|r| r.amount).sum();

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
                e(), e(), e(), e(), e(), e(),
                n(amount),
            ],
            bold: false,
        });
    }

    // 往返交通合计行（用车记录中 is_round_trip=true 的部分，进"往返交通"列 col[6]）
    if round_trip_total > 0.0 {
        rows.push(PreviewRow {
            cells: vec![j("往返交通"), e(), e(), e(), e(), e(), n(round_trip_total), e(), e(), n(round_trip_total)],
            bold: false,
        });
    }

    // 飞机票合计行
    if flight_total > 0.0 {
        rows.push(PreviewRow {
            cells: vec![j("飞机票"), e(), e(), n(flight_total), e(), e(), e(), e(), e(), n(flight_total)],
            bold: false,
        });
    }

    // 住宿合计行
    if hotel_total > 0.0 {
        rows.push(PreviewRow {
            cells: vec![j("住宿"), e(), e(), e(), n(hotel_total), e(), e(), e(), e(), n(hotel_total)],
            bold: false,
        });
    }

    // 市内交通合计行
    if car_total > 0.0 {
        rows.push(PreviewRow {
            cells: vec![j("市内交通"), e(), e(), e(), e(), n(car_total), e(), e(), e(), n(car_total)],
            bold: false,
        });
    }

    // 其他发票行
    if invoice_total > 0.0 {
        rows.push(PreviewRow {
            cells: vec![j("其他"), e(), n(invoice_total), e(), e(), e(), e(), e(), e(), n(invoice_total)],
            bold: false,
        });
    }

    // 出差补助行
    if subsidy_total > 0.0 {
        rows.push(PreviewRow {
            cells: vec![j("出差补助"), e(), e(), e(), e(), e(), e(), i(SUBSIDY_PER_DAY as u32), i(days), n(subsidy_total)],
            bold: false,
        });
    }

    // 合计行：col[2]=train+invoice（交通金额），col[6]=round_trip
    let total_amount = train_total + flight_total + hotel_total + car_total + round_trip_total + invoice_total + subsidy_total;
    rows.push(PreviewRow {
        cells: vec![
            j("合计"), e(),
            n(train_total + invoice_total),
            n(flight_total),
            n(hotel_total),
            n(car_total),
            n(round_trip_total),
            e(), e(),
            n(total_amount),
        ],
        bold: true,
    });

    rows
}

fn sum_amounts(records: &[InvoiceRecord], kind: &str) -> f64 {
    records
        .iter()
        .filter(|r| r.kind == kind)
        .filter_map(|r| r.amount)
        .sum()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn car(amount: f64, is_round_trip: bool) -> InvoiceRecord {
        InvoiceRecord {
            kind: "car".into(),
            amount: Some(amount),
            qr_amount: false,
            filename: "x.pdf".into(),
            full_path: "/x.pdf".into(),
            page_number: 1,
            train_number: None,
            departure_station: None,
            arrival_station: None,
            departure_time: None,
            hotel_name: None,
            check_in_date: None,
            check_out_date: None,
            nights: None,
            car_date: None,
            mileage: None,
            flight_number: None,
            departure_city: None,
            arrival_city: None,
            flight_date: None,
            invoice_code: None,
            invoice_number: None,
            issue_date: None,
            is_round_trip,
        }
    }

    #[test]
    fn car_records_split_into_city_and_round_trip_totals() {
        let records = vec![
            car(50.0, false),  // 市内
            car(120.0, true),  // 往返
            car(30.0, false),  // 市内
        ];
        let totals = calc_totals(&records, 0);
        assert_eq!(totals.car, 80.0, "市内交通合计 = 50 + 30");
        assert_eq!(totals.round_trip, 120.0, "往返交通合计 = 120");
        // total 含市内 + 往返，不能丢
        assert_eq!(totals.total, 80.0 + 120.0);
        // advance 原为 car+flight+hotel；现在 car 拆出往返，往返也应进 advance
        assert_eq!(totals.advance, 80.0 + 120.0);
    }

    #[test]
    fn preview_has_round_trip_column_after_city_transport() {
        let records = vec![car(120.0, true), car(50.0, false)];
        let rows = build_preview_rows(&records, 0);

        // 往返交通聚合行：col[0]=="往返交通"，col[6]==金额（往返交通列），col[9]==合计
        let rt = rows.iter().find(|r| {
            r.cells.first().and_then(|c| c.as_str()) == Some("往返交通")
        });
        assert!(rt.is_some(), "应包含往返交通聚合行");
        let rt = rt.unwrap();
        assert_eq!(rt.cells.len(), 10, "每行 10 列（含新增往返交通列）");
        assert_eq!(rt.cells[6].as_f64(), Some(120.0), "往返交通金额进第 6 列（往返交通列）");
        assert_eq!(rt.cells[9].as_f64(), Some(120.0), "最右合计列同步");

        // 市内交通行：col[5]==金额
        let city = rows.iter().find(|r| {
            r.cells.first().and_then(|c| c.as_str()) == Some("市内交通")
        });
        assert!(city.is_some(), "市内交通行仍存在");
        assert_eq!(city.unwrap().cells[5].as_f64(), Some(50.0));

        // 合计行 col[6] 含 round_trip
        let total = rows.iter().find(|r| r.bold);
        assert!(total.is_some());
        assert_eq!(total.unwrap().cells[6].as_f64(), Some(120.0));
    }
}