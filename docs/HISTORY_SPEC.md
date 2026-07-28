# 历史记录存储规范（History Storage Specification）

> Version: 1.0.0  
> Status: Proposed  
> Target: SnapClaim 1.4.0  
> Platform: Windows First, Cross-Platform Compatible  
> Runtime: Tauri 2 + Rust + React + TypeScript

---

## 1. Overview

SnapClaim 目前支持 PDF/图片识别、费用汇总、报销单预览和 Excel 导出，但**识别结果没有持久化存储**——用户关闭应用后数据丢失。

本规范引入基于 SQLite 的本地历史记录系统，允许用户：

- **保存**：识别完成后，一键将识别结果（InvoiceRecord[] + Totals + PreviewRow[]）存入本地数据库
- **查看**：通过历史记录列表浏览所有已保存的报销记录，按名称倒序排列
- **详情**：查看单条记录的报销单预览表（还原识别时的预览样式）
- **删除**：已报销/不需要的记录，从数据库中删除

---

## 2. Goals

### 2.1 Primary Goals

系统 MUST：

1. 使用 SQLite 作为存储引擎，本地持久化识别结果。
2. 支持一键保存当前识别结果（`InvoiceRecord[]` + `Totals` + `PreviewRow[]` + 出差日期）。
3. 在菜单栏「文件」下提供「历史记录」入口（快捷键 `CmdOrCtrl+H`）。
4. 以独立视图展示历史记录列表，按名称倒序排列。
5. 列表每行展示各分类金额汇总和单据张数。
6. 支持查看历史记录的报销单预览详情。
7. 支持删除不再需要的历史记录。
8. 数据库文件存放在应用同级目录 `data/db/snap-claim.db`。

### 2.2 Secondary Goals

系统 SHOULD：

1. 保存操作有 Toast/提示反馈。
2. 删除前有确认弹窗。
3. 数据库首次使用自动创建。

### 2.3 Non-Goals

以下功能不在本版本范围内：

- 历史记录搜索/按日期范围筛选
- 软删除/回收站
- 批量删除
- 从历史记录重新生成 Excel
- 数据同步/备份/导出
- 多云备份
- 历史记录编辑/修改

---

## 3. Design Decisions

| # | 决策点 | 选择 | 理由 |
|---|--------|------|------|
| 1 | 存储引擎 | **SQLite** | 支持结构化查询，方便后续按类型/日期/金额检索；扩展性好 |
| 2 | 触发保存方式 | **用户主动点击「保存记录」按钮** | 用户确认后才保存，不给用户意外写入 |
| 3 | 保存命名规则 | **自动以日期区间命名**（如 `20260720-20260727`） | 零操作成本；无日期时以当天日期 `YYYYMMDD` 命名 |
| 4 | 保存弹窗 | **无弹窗** | 一键保存，不打断流程 |
| 5 | 数据库路径 | 应用同级目录 `data/db/snap-claim.db` | 用户可手动管理数据库文件（复制/备份/删除） |
| 6 | 删除方式 | **删除该条记录**（`DELETE`） | 已报销单据无需保留，保持数据库精简 |
| 7 | 菜单入口 | 「文件」→「历史记录」，快捷键 `CmdOrCtrl+H` | 与现有菜单栏风格一致 |
| 8 | 历史页面类型 | **独立视图**（替换/覆盖主界面） | 完整展示列表，不挤占弹窗空间 |
| 9 | 列表排序 | **按名称倒序** | 最新保存的记录在最上面 |
| 10 | 详情页样式 | **复用报销单预览表**（`preview_rows`） | 所见即所得，与识别完成后的预览保持一致 |
| 11 | 数据表设计 | **两张表**（主表 + 明细表） | 明细平铺可支持未来按字段查询/统计 |

---

## 4. Database Schema

### 4.1 数据库文件

```
<app-dir>/
└── data/
    └── db/
        └── snap-claim.db
```

### 4.2 表结构

```sql
-- 主表：一次保存为一条记录
CREATE TABLE IF NOT EXISTS history_records (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,               -- 自动命名：日期区间 "20260720-20260727"
    created_at    TEXT NOT NULL,               -- ISO8601 格式保存时间
    remark        TEXT,                        -- 备注（预留字段，当前未使用）
    start_date    TEXT,                        -- 出差开始日期 YYYY-MM-DD
    end_date      TEXT,                        -- 出差结束日期 YYYY-MM-DD
    days          INTEGER DEFAULT 0,           -- 出差天数
    totals_json   TEXT NOT NULL,               -- Totals JSON 字符串
    preview_rows_json TEXT NOT NULL            -- PreviewRow[] JSON 字符串
);

-- 明细表：每条发票/票据为一行
CREATE TABLE IF NOT EXISTS history_items (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id           INTEGER NOT NULL,      -- FK → history_records.id
    type                TEXT NOT NULL,          -- train / flight / hotel / car / invoice
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
    is_round_trip       INTEGER DEFAULT 0,     -- 0=市内交通, 1=往返交通
    FOREIGN KEY (record_id) REFERENCES history_records(id) ON DELETE CASCADE
);

-- 索引：加速按 record_id 查询明细
CREATE INDEX IF NOT EXISTS idx_history_items_record_id
    ON history_items(record_id);

-- 索引：加速列表排序
CREATE INDEX IF NOT EXISTS idx_history_records_name
    ON history_records(name DESC);
```

### 4.3 数据流

```text
[识别完成]
     │
     ▼
[用户确认结果] ─→ 点击「保存记录」
     │
     ▼
[自动生成名称]
     │  ├── 有出差日期 → "20260720-20260727"
     │  └── 无出差日期 → "20260727"（当天日期）
     │
     ▼
[Rust 后端：save_history 命令]
     │
     ├── INSERT INTO history_records (name, created_at, start_date, end_date, days, totals_json, preview_rows_json)
     │
     └── FOR each InvoiceRecord →
         INSERT INTO history_items (record_id, type, amount, ...)
     │
     ▼
[返回 success] → 前端 Toast: "已保存"
```

```text
[用户点击「文件」→「历史记录」/ CmdOrCtrl+H]
     │
     ▼
[切换到历史列表视图]
     │
     ▼
[Rust 后端：get_history_list 命令]
     │
     ├── SELECT id, name, created_at, totals_json,
     │       (SELECT COUNT(*) FROM history_items WHERE record_id = r.id) AS item_count
     │   FROM history_records r
     │   ORDER BY name DESC
     │
     ▼
[前端渲染列表]
     │
     ├── 名称、保存时间、各分类金额、总金额、城际交通张数、其他张数、备注
     ├── 操作：【查看详情】【删除】
     │
     ├── 【查看详情】→ Rust 后端 get_history_detail(id)
     │   ├── SELECT * FROM history_records WHERE id = ?
     │   ├── SELECT * FROM history_items WHERE record_id = ?
     │   └── 前端渲染报销单预览表（preview_rows_json）
     │
     └── 【删除】→ 确认弹窗 → Rust 后端 delete_history(id)
         └── DELETE FROM history_records WHERE id = ?（级联删除明细）
```

---

## 5. Technology Stack

| Component         | Technology                   |
| ----------------- | ---------------------------- |
| Database Engine   | SQLite                       |
| Rust SQLite Driver | `rusqlite` 或 `sqlx`        |
| Desktop Framework | Tauri 2                      |
| Backend           | Rust                         |
| Frontend          | React + TypeScript           |
| Serialization     | serde + serde_json           |

---

## 6. Tauri Commands

新增 Rust 命令（在 `src-tauri/src/commands/` 下新建 `history.rs`）：

```rust
// src-tauri/src/commands/history.rs

/// 保存当前识别结果到数据库
#[tauri::command]
pub async fn save_history(
    state: tauri::State<'_, AppState>,
    records: Vec<InvoiceRecord>,
    totals: Totals,
    preview_rows: Vec<PreviewRow>,
    start_date: Option<String>,
    end_date: Option<String>,
    days: u32,
) -> Result<HistoryRecord, AppError>;

/// 获取历史记录列表
#[tauri::command]
pub async fn get_history_list(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<HistorySummary>, AppError>;

/// 获取单条历史记录完整详情
#[tauri::command]
pub async fn get_history_detail(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> Result<HistoryDetail, AppError>;

/// 删除指定历史记录
#[tauri::command]
pub async fn delete_history(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> Result<(), AppError>;
```

### 6.1 响应类型

```rust
// 列表摘要
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistorySummary {
    pub id: i64,
    pub name: String,
    pub created_at: String,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub days: u32,
    pub totals: Totals,            // 从 totals_json 反序列化
    pub intercity_count: u32,      // 城际交通张数（train + flight）
    pub other_count: u32,          // 其他张数（hotel + car + invoice）
    pub remark: Option<String>,
}

// 详情
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
    pub records: Vec<InvoiceRecord>,  // 从 history_items 恢复
    pub preview_rows: Vec<PreviewRow>, // 从 preview_rows_json 反序列化
    pub remark: Option<String>,
}
```

---

## 7. Database Module

新增 `src-tauri/src/services/database.rs`：

```rust
/// 数据库管理模块
pub struct Database {
    conn: Connection,
}

impl Database {
    /// 打开或创建数据库（自动建表）
    pub fn open(db_path: &str) -> Result<Self, AppError>;

    /// 保存历史记录
    pub fn save_history(
        &self,
        name: &str,
        records: &[InvoiceRecord],
        totals: &Totals,
        preview_rows: &[PreviewRow],
        start_date: Option<&str>,
        end_date: Option<&str>,
        days: u32,
    ) -> Result<HistoryRecord, AppError>;

    /// 获取列表
    pub fn get_history_list(&self) -> Result<Vec<HistorySummary>, AppError>;

    /// 获取详情
    pub fn get_history_detail(&self, id: i64) -> Result<HistoryDetail, AppError>;

    /// 删除记录
    pub fn delete_history(&self, id: i64) -> Result<(), AppError>;
}
```

### 7.1 初始化流程

```text
应用启动
    │
    ▼
获取应用路径（std::env::current_exe）
    │
    ▼
拼接 data/db/snap-claim.db
    │
    ▼
如果目录不存在 → 创建目录
    │
    ▼
如果文件不存在 → 自动创建 + 建表
    │
    ▼
打开连接，设置 WAL 模式（PRAGMA journal_mode=WAL）
    │
    ▼
Database 实例 → 注册为 Tauri State
```

---

## 8. Frontend Architecture

### 8.1 目录结构

```text
src/
├── components/
│   ├── history/
│   │   ├── HistoryView.tsx          # 历史记录主视图（列表页）
│   │   ├── HistoryDetailView.tsx    # 历史记录详情页
│   │   └── HistoryListItem.tsx      # 列表行组件
│   │
│   ├── Panels.tsx                   # [修改] 添加「保存记录」按钮
│   └── ...（其余现有组件）
│
├── lib/
│   └── tauri.ts                     # [修改] 新增 history 相关 invoke 封装
│
└── App.tsx                          # [修改] 新增视图切换逻辑
```

### 8.2 视图切换

在 `App.tsx` 中维护一个视图状态：

```typescript
type ViewState =
  | { kind: 'main' }           // 主界面（识别）
  | { kind: 'history' }        // 历史记录列表
  | { kind: 'history_detail'; id: number }  // 历史详情
```

菜单事件 `menu://event` 中 `id = "file_history"` 时，切换到 `history` 视图。

由「返回」按钮或在详情页操作后回到列表；列表页「返回」回到主界面。

### 8.3 保存按钮

在 `RightPanel` 的「识别结果」标题栏右侧，与「批量分类用车」并列：

```tsx
{records.length > 0 && (
  <button className="btn-secondary text-xs px-3 py-1" onClick={onSave}>
    保存记录
  </button>
)}
```

点击 → 调用 `invoke('save_history', ...)` → 成功后 Toast 提示。

### 8.4 历史记录列表页

| 列 | 内容 | 对齐 |
|------|------|------|
| 名称 | 自动生成的日期区间 | 左 |
| 保存时间 | 如 `2026-07-27 14:30:25` | 左 |
| 火车金额 | `¥600.00` | 右 |
| 飞机金额 | `¥1,200.00` | 右 |
| 住宿金额 | `¥800.00` | 右 |
| 用车金额 | `¥350.00` | 右 |
| 补助金额 | `¥150.00` | 右 |
| 预借金额 | `¥2,000.00` | 右 |
| 退补金额 | `¥-900.00` | 右 |
| 总金额 | `¥3,100.00`（加粗） | 右 |
| 城际交通 | 张数，如 `3` | 中 |
| 其他 | 张数，如 `2` | 中 |
| 备注 | 文本 | 左 |
| 操作 | 【查看详情】【删除】 | 中 |

### 8.5 详情页

展示该条记录保存时对应的报销单预览（`preview_rows_json` 渲染），样式与 `RightPanel` 中的报销单预览表完全一致，并增加顶部的汇总信息卡片。

---

## 9. Menu Changes

在 `src-tauri/src/lib.rs` 中修改「文件」菜单：

```rust
let file = Submenu::with_items(
    app,
    "文件",
    true,
    &[
        &MenuItem::with_id(app, "file_add", "添加文件...", true, Some("CmdOrCtrl+O"))?,
        &MenuItem::with_id(app, "file_history", "历史记录", true, Some("CmdOrCtrl+H"))?,
        &PredefinedMenuItem::separator(app)?,
        &MenuItem::with_id(app, "file_clear", "清空", true, None::<&str>)?,
        &quit,
    ],
)?;
```

前端监听 `menu://event`，当 `id === "file_history"` 时切换到历史列表视图。

---

## 10. Data Flow Diagram

```text
┌─────────────────────────────────────────────────────────────┐
│                      应用启动                                 │
│                                                             │
│  ┌─────────────────┐    ┌───────────────────────────────┐   │
│  │ 主界面（识别）    │    │ 菜单「文件」→「历史记录」      │   │
│  │                  │    │ 或 Ctrl+H                     │   │
│  │  ┌────────────┐  │    └───────────┬───────────────────┘   │
│  │  │ 识别完成    │  │               │                       │
│  │  └──────┬─────┘  │               ▼                       │
│  │         │        │    ┌──────────────────────┐           │
│  │         ▼        │    │  历史记录列表视图      │           │
│  │  ┌────────────┐  │    │                      │           │
│  │  │ 保存记录按钮 │  │    │  列表展示所有保存记录 │           │
│  │  └──────┬─────┘  │    │                      │           │
│  │         │        │    └──┬────────┬──────────┘           │
│  │         ▼        │       │        │                       │
│  │  ┌────────────┐  │       │        │                       │
│  │  │ 写入 SQLite │  │       ▼        ▼                       │
│  │  └────────────┘  │  ┌────────┐ ┌──────────────┐           │
│  └─────────────────┘  │ 查看详情 │ │ 删除确认弹窗  │           │
│                        └────┬───┘ └──────┬───────┘           │
│                             │            │                    │
│                             ▼            ▼                    │
│                      ┌──────────┐ ┌──────────────┐           │
│                      │ 详情视图  │ │ DELETE 该条   │           │
│                      │ 报销单预览│ │ 历史记录     │           │
│                      └──────────┘ └──────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Implementation Phases

### Phase 1: Database Layer

- [ ] 添加 `rusqlite` 依赖到 `Cargo.toml`
- [ ] 实现 `src-tauri/src/services/database.rs`
  - [ ] `open()` — 创建/打开数据库，自动建表
  - [ ] `save_history()` — 事务写入主表 + 明细表
  - [ ] `get_history_list()` — 查询列表（含张数统计）
  - [ ] `get_history_detail()` — 查询单条详情
  - [ ] `delete_history()` — 删除记录（CASCADE 删明细）
- [ ] 单元测试覆盖所有 CRUD 操作

### Phase 2: Tauri Commands

- [ ] 新建 `src-tauri/src/commands/history.rs`
- [ ] 实现 4 个 tauri 命令（save/getList/getDetail/delete）
- [ ] 在 `lib.rs` 中注册命令 + 管理 Database State
- [ ] 修改菜单栏，增加「历史记录」项

### Phase 3: Frontend — 保存功能

- [ ] `src/lib/tauri.ts` 新增 `saveHistory` / `getHistoryList` / `getHistoryDetail` / `deleteHistory` 封装
- [ ] `Panels.tsx` 「识别结果」标题栏添加「保存记录」按钮
- [ ] 扩展 `App.tsx` 回调，处理保存逻辑 + Toast 反馈

### Phase 4: Frontend — 历史记录视图

- [ ] 新建 `src/components/history/HistoryView.tsx`
  - [ ] 列表渲染（分类金额列 + 张数列）
  - [ ] 删除确认弹窗
- [ ] 新建 `src/components/history/HistoryDetailView.tsx`
  - [ ] 报销单预览表渲染（复用 `preview_rows_json`）
  - [ ] 顶部汇总信息卡片
- [ ] `App.tsx` 视图状态管理（main / history / history_detail）
- [ ] 菜单快捷键 `CmdOrCtrl+H` 监听切换

---

## 12. Key Implementation Details

### 12.1 数据库路径获取

```rust
fn get_db_path() -> Result<String, AppError> {
    let exe = std::env::current_exe()?;
    let exe_dir = exe.parent().ok_or(AppError::Internal("cannot get exe dir".into()))?;
    let db_dir = exe_dir.join("data").join("db");
    std::fs::create_dir_all(&db_dir)?;
    let db_path = db_dir.join("snap-claim.db");
    Ok(db_path.to_string_lossy().to_string())
}
```

### 12.2 保存命名规则

```rust
fn generate_name(start_date: Option<&str>, end_date: Option<&str>) -> String {
    match (start_date, end_date) {
        (Some(s), Some(e)) => format!("{}-{}", s.replace("-", ""), e.replace("-", "")),
        _ => {
            let today = chrono::Local::now().format("%Y%m%d").to_string();
            today
        }
    }
}
```

### 12.3 城际交通/其他单据计数

```sql
-- 在 get_history_list 查询中
SELECT
    r.id,
    r.name,
    r.created_at,
    r.totals_json,
    r.remark,
    (SELECT COUNT(*) FROM history_items WHERE record_id = r.id AND type IN ('train', 'flight')) AS intercity_count,
    (SELECT COUNT(*) FROM history_items WHERE record_id = r.id AND type NOT IN ('train', 'flight')) AS other_count
FROM history_records r
ORDER BY r.name DESC
```

---

## 13. Risks and Open Issues

| 风险 | 影响 | 缓解 |
|------|------|------|
| 应用安装在 `Program Files` 时，同级目录可能不可写 | 数据库创建失败 | 主方案使用同级目录；若写入失败 fallback 到 Tauri `app_data_dir` |
| SQLite WAL 模式下跨进程访问冲突 | 用户打开两个实例写同一个 db | Tauri 已通过 single-instance 插件保证单实例运行 |
| 数据库文件过大（长期使用积累大量数据） | 列表查询变慢 | 索引已覆盖排序和关联查询；用户可手动删除已报销记录 |
| 保存时识别结果正在被用户编辑/修改 | 保存的数据与用户预期不一致 | 建议用户在确认最终结果后再保存；当前不做实时联动 |

---

## 14. Files to Modify / Create

### 修改

- `src-tauri/Cargo.toml` — 新增 `rusqlite` 依赖
- `src-tauri/src/lib.rs` — 注册 Database State + history 命令 + 菜单修改
- `src-tauri/src/commands/mod.rs` — 注册 `history` 模块
- `src/App.tsx` — 视图状态管理 + 历史记录入口事件
- `src/components/Panels.tsx` — 添加「保存记录」按钮
- `src/lib/tauri.ts` — 新增 history 相关 invoke 封装
- `src/types/index.ts` — 新增历史记录相关类型定义

### 新增

- `src-tauri/src/services/database.rs` — 数据库 CRUD 模块
- `src-tauri/src/commands/history.rs` — Tauri 命令
- `src/components/history/HistoryView.tsx` — 历史记录列表视图
- `src/components/history/HistoryDetailView.tsx` — 历史详情视图

---

## 15. Acceptance Criteria

1. 用户识别完成后，可点击「保存记录」按钮，一键保存。
2. 保存后识别结果的名称自动生成（日期区间或当天日期）。
3. 保存成功后前端显示 Toast 提示。
4. 菜单「文件」→「历史记录」（`CmdOrCtrl+H`）切换到历史列表视图。
5. 历史列表按名称倒序排列，展示各分类金额汇总和城际/其他张数。
6. 点击「查看详情」展示报销单预览表（与识别时的预览样式一致）。
7. 点击「删除」弹出确认弹窗，确认后删除记录。
8. 数据库文件位于 `<app-dir>/data/db/snap-claim.db`，首次使用自动创建。
9. 关闭应用后重新打开，历史记录仍然存在。
10. 现有识别、导出、更新功能不受影响。

---

## 16. Summary

SnapClaim 通过 SQLite 本地数据库实现识别结果的持久化存储和查看。核心流程为：

- **保存**：用户确认识别结果 → 点击「保存记录」→ 自动命名 → 写入 SQLite
- **查看**：菜单「历史记录」→ 列表视图（按日期倒序）→ 查看详情（报销单预览）
- **删除**：选定记录 → 确认弹窗 → 删除该条记录

以最小的交互成本（一键保存、无弹窗）实现数据的持久化，数据库文件在应用同级目录下，用户可完全掌控。
