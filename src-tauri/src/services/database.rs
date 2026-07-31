use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

use crate::models::{InvoiceRecord, PreviewRow, Totals};

/// 数据库管理模块
pub struct Database {
    conn: Mutex<Connection>,
}

// ─── 历史记录响应类型 ─────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistorySummary {
    pub id: i64,
    pub name: String,
    pub created_at: String,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub days: u32,
    pub totals: Totals,
    pub intercity_count: u32,
    pub other_count: u32,
    pub remark: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryDetail {
    pub id: i64,
    pub name: String,
    pub created_at: String,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub days: u32,
    pub totals: Totals,
    pub records: Vec<InvoiceRecord>,
    pub preview_rows: Vec<PreviewRow>,
    pub remark: Option<String>,
}

impl Database {
    /// 打开或创建数据库（自动建表）
    pub fn open() -> Result<Self, crate::error::AppError> {
        let db_path = get_db_path()?;
        tracing::info!("opening database at: {}", db_path);

        let conn = Connection::open(&db_path)?;

        // WAL 模式提升并发读性能
        conn.execute_batch("PRAGMA journal_mode=WAL;")?;

        // 建表
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS history_records (
                id                 INTEGER PRIMARY KEY AUTOINCREMENT,
                name               TEXT NOT NULL,
                created_at         TEXT NOT NULL,
                remark             TEXT,
                start_date         TEXT,
                end_date           TEXT,
                days               INTEGER DEFAULT 0,
                totals_json        TEXT NOT NULL,
                preview_rows_json  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS history_items (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                record_id           INTEGER NOT NULL,
                type                TEXT NOT NULL,
                amount              REAL,
                qr_amount           INTEGER DEFAULT 0,
                filename            TEXT NOT NULL,
                full_path           TEXT NOT NULL,
                page_number         INTEGER DEFAULT 1,
                train_number        TEXT,
                departure_station   TEXT,
                arrival_station     TEXT,
                departure_time      TEXT,
                hotel_name          TEXT,
                check_in_date       TEXT,
                check_out_date      TEXT,
                nights              INTEGER,
                car_date            TEXT,
                mileage             REAL,
                flight_number       TEXT,
                departure_city      TEXT,
                arrival_city        TEXT,
                flight_date         TEXT,
                invoice_code        TEXT,
                invoice_number      TEXT,
                issue_date          TEXT,
                is_round_trip       INTEGER DEFAULT 0,
                FOREIGN KEY (record_id) REFERENCES history_records(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_history_items_record_id
                ON history_items(record_id);

            CREATE INDEX IF NOT EXISTS idx_history_records_name
                ON history_records(name DESC);
            ",
        )?;

        Ok(Database {
            conn: Mutex::new(conn),
        })
    }

    /// 保存历史记录（事务写入主表 + 明细表）
    pub fn save_history(
        &self,
        name: &str,
        records: &[InvoiceRecord],
        totals: &Totals,
        preview_rows: &[PreviewRow],
        start_date: Option<&str>,
        end_date: Option<&str>,
        days: u32,
    ) -> Result<HistoryDetail, crate::error::AppError> {
        let now = chrono_now();
        let totals_json = serde_json::to_string(totals)?;
        let preview_rows_json = serde_json::to_string(preview_rows)?;

        // 独立作用域：锁定 → 写入 → commit → 释放锁，避免与 get_history_detail 死锁
        let record_id = {
            let mut conn = self.conn.lock().unwrap();
            let tx = conn.transaction()?;

            // 插入主表
            tx.execute(
                "INSERT INTO history_records (name, created_at, start_date, end_date, days, totals_json, preview_rows_json)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![name, now, start_date, end_date, days, totals_json, preview_rows_json],
            )?;

            let record_id = tx.last_insert_rowid();

            // 插入明细（独立作用域确保 stmt 在 commit 前 drop）
            {
                let mut stmt = tx.prepare(
                    "INSERT INTO history_items (record_id, type, amount, qr_amount, filename, full_path, page_number,
                      train_number, departure_station, arrival_station, departure_time,
                      hotel_name, check_in_date, check_out_date, nights,
                      car_date, mileage,
                      flight_number, departure_city, arrival_city, flight_date,
                      invoice_code, invoice_number, issue_date,
                      is_round_trip)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7,
                      ?8, ?9, ?10, ?11,
                      ?12, ?13, ?14, ?15,
                      ?16, ?17,
                      ?18, ?19, ?20, ?21,
                      ?22, ?23, ?24,
                      ?25)",
                )?;

                for r in records {
                    stmt.execute(params![
                        record_id,
                        r.kind,
                        r.amount,
                        r.qr_amount as i32,
                        r.filename,
                        r.full_path,
                        r.page_number,
                        r.train_number,
                        r.departure_station,
                        r.arrival_station,
                        r.departure_time,
                        r.hotel_name,
                        r.check_in_date,
                        r.check_out_date,
                        r.nights,
                        r.car_date,
                        r.mileage,
                        r.flight_number,
                        r.departure_city,
                        r.arrival_city,
                        r.flight_date,
                        r.invoice_code,
                        r.invoice_number,
                        r.issue_date,
                        r.is_round_trip as i32,
                    ])?;
                }
            } // stmt 在这里 drop

            tx.commit()?;
            record_id
        }; // conn (MutexGuard) 在这里 drop，锁释放

        // 返回完整的详情（此时锁已释放，不会死锁）
        self.get_history_detail(record_id)
    }

    /// 获取历史记录列表（按名称倒序）
    pub fn get_history_list(&self) -> Result<Vec<HistorySummary>, crate::error::AppError> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare(
            "SELECT id, name, created_at, start_date, end_date, days, totals_json, remark
             FROM history_records
             ORDER BY name DESC",
        )?;

        // 先收集所有行数据，释放 stmt 的借用
        let rows_data = stmt.query_map([], |row| {
            let id: i64 = row.get(0)?;
            let name: String = row.get(1)?;
            let created_at: String = row.get(2)?;
            let start_date: Option<String> = row.get(3)?;
            let end_date: Option<String> = row.get(4)?;
            let days: u32 = row.get::<_, i32>(5)? as u32;
            let totals_json: String = row.get(6)?;
            let remark: Option<String> = row.get(7)?;
            Ok((
                id,
                name,
                created_at,
                start_date,
                end_date,
                days,
                totals_json,
                remark,
            ))
        })?;
        let rows_data: Vec<_> = rows_data.collect::<Result<Vec<_>, _>>()?;
        // stmt 在此 drop

        let mut summaries = Vec::new();
        for (id, name, created_at, start_date, end_date, days, totals_json, remark) in rows_data {
            let totals: Totals = serde_json::from_str(&totals_json)?;

            // 计算城际交通/其他张数
            let intercity_count: u32 =
                conn.query_row(
                    "SELECT COUNT(*) FROM history_items WHERE record_id = ?1 AND type IN ('train', 'flight')",
                    params![id],
                    |row| row.get::<_, i32>(0),
                )? as u32;

            let other_count: u32 =
                conn.query_row(
                    "SELECT COUNT(*) FROM history_items WHERE record_id = ?1 AND type NOT IN ('train', 'flight')",
                    params![id],
                    |row| row.get::<_, i32>(0),
                )? as u32;

            summaries.push(HistorySummary {
                id,
                name,
                created_at,
                start_date,
                end_date,
                days,
                totals,
                intercity_count,
                other_count,
                remark,
            });
        }

        Ok(summaries)
    }

    /// 获取单条历史记录完整详情
    pub fn get_history_detail(&self, id: i64) -> Result<HistoryDetail, crate::error::AppError> {
        let conn = self.conn.lock().unwrap();

        let (name, created_at, start_date, end_date, days, totals_json, preview_rows_json, remark) = conn
            .query_row(
                "SELECT name, created_at, start_date, end_date, days, totals_json, preview_rows_json, remark
                 FROM history_records WHERE id = ?1",
                params![id],
                |row| {
                    let name: String = row.get(0)?;
                    let created_at: String = row.get(1)?;
                    let start_date: Option<String> = row.get(2)?;
                    let end_date: Option<String> = row.get(3)?;
                    let days: i32 = row.get(4)?;
                    let totals_json: String = row.get(5)?;
                    let preview_rows_json: String = row.get(6)?;
                    let remark: Option<String> = row.get(7)?;
                    Ok((
                        name, created_at, start_date, end_date, days as u32,
                        totals_json, preview_rows_json, remark,
                    ))
                },
            )?;

        let totals: Totals = serde_json::from_str(&totals_json)?;
        let preview_rows: Vec<PreviewRow> = serde_json::from_str(&preview_rows_json)?;

        // 查明细
        let mut stmt = conn.prepare(
            "SELECT type, amount, qr_amount, filename, full_path, page_number,
                train_number, departure_station, arrival_station, departure_time,
                hotel_name, check_in_date, check_out_date, nights,
                car_date, mileage,
                flight_number, departure_city, arrival_city, flight_date,
                invoice_code, invoice_number, issue_date,
                is_round_trip
             FROM history_items WHERE record_id = ?1 ORDER BY id",
        )?;

        let records: Vec<InvoiceRecord> = stmt
            .query_map(params![id], |row| {
                let is_round_trip: i32 = row.get(23)?;
                Ok(InvoiceRecord {
                    kind: row.get(0)?,
                    amount: row.get(1)?,
                    qr_amount: row.get::<_, i32>(2)? != 0,
                    filename: row.get(3)?,
                    full_path: row.get(4)?,
                    page_number: row.get::<_, i32>(5)? as u32,
                    train_number: row.get(6)?,
                    departure_station: row.get(7)?,
                    arrival_station: row.get(8)?,
                    departure_time: row.get(9)?,
                    hotel_name: row.get(10)?,
                    check_in_date: row.get(11)?,
                    check_out_date: row.get(12)?,
                    nights: row.get(13)?,
                    car_date: row.get(14)?,
                    mileage: row.get(15)?,
                    flight_number: row.get(16)?,
                    departure_city: row.get(17)?,
                    arrival_city: row.get(18)?,
                    flight_date: row.get(19)?,
                    invoice_code: row.get(20)?,
                    invoice_number: row.get(21)?,
                    issue_date: row.get(22)?,
                    is_round_trip: is_round_trip != 0,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(HistoryDetail {
            id,
            name,
            created_at,
            start_date,
            end_date,
            days,
            totals,
            records,
            preview_rows,
            remark,
        })
    }

    /// 删除指定历史记录（级联删明细，DELETE CASCADE 自动处理）
    pub fn delete_history(&self, id: i64) -> Result<(), crate::error::AppError> {
        let conn = self.conn.lock().unwrap();
        let affected = conn.execute("DELETE FROM history_records WHERE id = ?1", params![id])?;
        if affected == 0 {
            return Err(crate::error::AppError::Database(format!(
                "记录 ID {} 不存在",
                id
            )));
        }
        Ok(())
    }
}

/// 获取数据库文件路径：<exe_dir>/data/db/snap-claim.db
fn get_db_path() -> Result<String, crate::error::AppError> {
    let exe = std::env::current_exe()?;
    let exe_dir = exe
        .parent()
        .ok_or_else(|| crate::error::AppError::Database("无法获取可执行文件目录".into()))?;
    let db_dir = exe_dir.join("data").join("db");
    std::fs::create_dir_all(&db_dir)?;
    let db_path = db_dir.join("snap-claim.db");
    Ok(db_path.to_string_lossy().to_string())
}

/// 当前时间的 ISO8601 格式字符串
fn chrono_now() -> String {
    // 用 std 时间手动格式化，避免引入 chrono
    let dur = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = dur.as_secs();
    // 从 1970-01-01 计算年月日时分秒
    let (year, month, day, hour, min, sec) = timestamp_to_ymdhms(secs);
    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
        year, month, day, hour, min, sec
    )
}

fn timestamp_to_ymdhms(secs: u64) -> (u64, u64, u64, u64, u64, u64) {
    // 简单的公历计算（不考虑闰秒，只考虑闰年）
    const SECS_PER_DAY: u64 = 86400;
    let days = secs / SECS_PER_DAY;
    let time_secs = secs % SECS_PER_DAY;
    let hour = time_secs / 3600;
    let min = (time_secs % 3600) / 60;
    let sec = time_secs % 60;

    let (year, month, day) = days_to_date(days);
    (year, month as u64, day as u64, hour, min, sec)
}

fn days_to_date(days: u64) -> (u64, u32, u32) {
    // 从 1970-01-01 开始
    let mut y = 1970u64;
    let mut remaining = days as i64;

    loop {
        let days_in_year = if is_leap(y) { 366 } else { 365 };
        if remaining < days_in_year {
            break;
        }
        remaining -= days_in_year;
        y += 1;
    }

    const MONTH_DAYS: &[u32] = &[31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut m = 1u32;
    for &md in MONTH_DAYS {
        let dim = if m == 2 && is_leap(y) { md + 1 } else { md };
        if (remaining as u32) < dim {
            break;
        }
        remaining -= dim as i64;
        m += 1;
    }
    let d = (remaining as u32) + 1;
    (y, m, d)
}

fn is_leap(year: u64) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}
