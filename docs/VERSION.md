# SnapClaim 版本信息

> 记录每个版本的功能规划、设计决策与变更说明。
> 当前发布版本：**v1.1.0**
---

## v1.1.0（已发布）

### 新增功能

#### 用车记录批量分类（双态勾选方案）

**背景**：报销单中的「用车记录」需要区分为「市内交通」与「往返交通」两类。早期考虑过"自动识别"方案，但自动识别会**猜测业务意图**，不符合企业工具的设计原则。

**设计决策**：采用「双态勾选」批量编辑模式。核心思想——

> **先确定要修改成什么，再选择修改哪些。**

不猜测业务意图，让用户用最少的操作完成明确的分类。这与多数专业办公软件的批量编辑思路一致。

**交互流程**：

1. 顶部单选当前要编辑的交通类型（市内交通 / 往返交通）
2. 在用车记录列表中勾选属于该类型的记录
3. 未勾选记录自动归到另一类型
4. 点击「确定」完成分类

**内部映射逻辑**（始终只有两类——勾选 / 未勾选，根据顶部选择做一次映射）：

```rust
if selected_type == CityTransport {
    // 勾选的设为市内
    // 未勾选的设为往返
} else {
    // 勾选的设为往返
    // 未勾选的设为市内
}
```

这是一个干净的设计。

**操作次数对比**：

| 场景 | 流程 | 操作次数 |
| --- | --- | --- |
| 全部往返交通（出差） | 选往返交通 → 全选 → 确定 | 3 次 |
| 仅 1 张市内交通 | 选市内交通 → 勾 1 张 → 确定 | — |
| 仅 1 张往返交通 | 选往返交通 → 勾 1 张 → 确定 | — |

对比"默认全部市内交通"方案：在仅 1 张市内交通的场景下需要勾 4 张往返交通，效率反而更低。本方案在不同数据分布下都能保持最少勾选量。

### 实现细节

#### 数据模型

- `InvoiceRecord` 新增 `is_round_trip: bool` 字段（[src-tauri/src/models/mod.rs](file:///Volumes/SanXiaoXing/Blog/Code/snap-claim-rs/src-tauri/src/models/mod.rs)、[src/types/index.ts](file:///Volumes/SanXiaoXing/Blog/Code/snap-claim-rs/src/types/index.ts)）
  - `#[serde(default)]` 兼容旧记录，缺省值 `false`（市内交通）
  - 识别时新建的 car 记录一律 `false`，由前端批量分类弹窗改写
- `Totals` 新增 `round_trip: f64` 字段，往返交通独立合计
  - 报销单「交通金额」列同时容纳 train / invoice / round_trip

#### 后端逻辑

- `expense_calculator.rs`：用车记录按 `is_round_trip` 拆成市内 / 往返两类
  - `calc_totals`：`car` 与 `round_trip` 分别合计；`advance` / `total` 同步纳入 `round_trip`
  - `build_preview_rows`：新增「往返交通」聚合行（`is_round_trip=true` 的 car 记录进第 6 列）
  - 旧记录无该字段时全部归市内，行为与重构前一致
- `recognition.rs`：新建 car 记录默认 `is_round_trip: false`
- 新增单元测试：
  - `car_records_split_into_city_and_round_trip_totals`：校验拆分合计与 `total` / `advance` 的纳入
  - `preview_has_round_trip_column_after_city_transport`：校验 10 列结构与往返交通行列位置

#### Excel 导出

- `excel_service.rs`：表头由 9 列扩为 10 列，新增「往返交通」列（位于「市内交通」与「补助标准」之间）
- 与前端 `Panels.tsx` 预览列严格对齐，单一真相源在两处副本同步维护

#### 前端交互

- 新增 [CarClassifyModal.tsx](file:///Volumes/SanXiaoXing/Blog/Code/snap-claim-rs/src/components/CarClassifyModal.tsx)：双态勾选批量分类弹窗
  - 顶部单选切换编辑目标类型，动态提示文案随之变化
  - 操作按钮：全选 / 反选 / 清空（反选用于切换类型时迁移勾选态）
  - 每行展示「原归类 → 新归类」预览，变化项加删除线引导
  - 打开时按当前 `isRoundTrip` 智能预勾选，Esc 关闭
- [App.tsx](file:///Volumes/SanXiaoXing/Blog/Code/snap-claim-rs/src/App.tsx)：
  - 识别完成且含 car 记录时自动弹分类窗 + 报销预览暂隐（`carClassifyPending` 态）
  - 确认后复用 `recognize_invoices` 的重算路径（空 `file_paths` + 传回 updated records），不新增 Tauri 命令
  - 手动点「批量分类用车」二次分类不进入预览暂隐态
- [Panels.tsx](file:///Volumes/SanXiaoXing/Blog/Code/snap-claim-rs/src/components/Panels.tsx)：
  - RightPanel 仅当存在 car 记录时显示「批量分类用车」入口
  - 识别结果表 car 类型行显示子分类标签（市内/往返）
  - 报销单预览新增「往返交通」列，列宽数组同步扩展

### 版本号同步

| 文件 | 旧版本 | 新版本 |
| --- | --- | --- |
| `src-tauri/tauri.conf.json` | 1.0.0 | 1.1.0 |
| `src-tauri/Cargo.toml` | 1.0.0 | 1.1.0 |
| `package.json` | 0.1.0 | 1.1.0 |
| `src/components/AboutModal.tsx` | Version 1.0.0 | Version 1.1.0 |

---

## v1.0.0（已发布）

### 首版功能

- Rust + Tauri 2 + React 重构，从原 Python (Nuitka) 项目迁移
- PDF 发票识别（火车票、酒店、用车、机票、发票 5 类）
- 二维码金额提取（etripCar / etripHotel / etrip 协议头）
- PDF 文本提取与 PDF 合并（基于 pdfium-render）
- Excel 报销单导出（基于 rust_xlsxwriter）
- 中文金额大写转换
- 5 套主题切换、原生菜单栏、拖拽文件、出差日期日历
