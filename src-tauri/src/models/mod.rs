use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceRecord {
    #[serde(rename = "type")]
    pub kind: String,
    pub amount: Option<f64>,
    pub qr_amount: bool,
    pub filename: String,
    pub full_path: String,
    pub page_number: u32,
    pub train_number: Option<String>,
    pub departure_station: Option<String>,
    pub arrival_station: Option<String>,
    pub departure_time: Option<String>,
    pub hotel_name: Option<String>,
    pub check_in_date: Option<String>,
    pub check_out_date: Option<String>,
    pub nights: Option<u32>,
    pub car_date: Option<String>,
    pub mileage: Option<f64>,
    pub flight_number: Option<String>,
    pub departure_city: Option<String>,
    pub arrival_city: Option<String>,
    pub flight_date: Option<String>,
    pub invoice_code: Option<String>,
    pub invoice_number: Option<String>,
    pub issue_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Totals {
    pub train: f64,
    pub flight: f64,
    pub hotel: f64,
    pub car: f64,
    pub invoice: f64,
    pub subsidy: f64,
    pub advance: f64,
    pub refund: f64,
    pub total: f64,
    pub chinese: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewRow {
    pub cells: Vec<serde_json::Value>,
    pub bold: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecognitionResult {
    pub records: Vec<InvoiceRecord>,
    pub totals: Totals,
    pub preview_rows: Vec<PreviewRow>,
}