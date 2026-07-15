# 图片识别功能（Image Recognition）

> 计划新增功能：识别携程商旅 App 订单列表截图，零成本生成 `InvoiceRecord`。
> 设计阶段文档，供后续实现参考。

---

## 1. 背景与目标

### 用户痛点

现有 [recognize_invoices](file:///c:/Users/SanXiaoXing/Desktop/Code/snap-claim-rs/src-tauri/src/commands/recognition.rs) 流程要求用户先拿到电子发票 PDF（高铁票 PDF、酒店确认函 PDF 等），再拖入应用识别。

但企业出差场景中，相当一部分订单**没有 PDF**：

- 携程商旅 App 内直接出行的打车 / 机票（行程单 PDF 可有可无）
- 酒店预订单（依赖酒店主动开票）
- 跨城顺风车、网约车

用户实际工作流：在携程商旅 App 翻历史订单 → 对着截图一条条手敲进报销单。**一次出差 10+ 条记录，每条 4-5 个字段**。

### 目标

输入一张携程商旅 App 订单列表截图（PNG/JPG），自动解析出多条 `InvoiceRecord`（type + amount），无缝汇入现有识别结果。

### 非目标

- 完整字段提取（起止日期、出发地、目的地、酒店名等）—— 见 [§3 决策记录](#3-决策记录)
- 多 App 适配（去哪儿、飞猪、滴滴等）—— 留待 v1 验证后再扩展
- 实时摄像头拍照识别

---

## 2. 输入样本

测试样例图（用户提供的携程商旅 App 截图）特征：

```
┌─────────────────────────────────────────────────────────┐
│  行程  [高铁] [机票] [打车] [住宿]              ⋯       │
├─────────────────────────────────────────────────────────┤
│  类别  起始日期/时间  终止日期/时间  人数  凭证号  状态 │
├─────────────────────────────────────────────────────────┤
│  打车  2026-07-08 09:36:13  ...:24:36  1人  521... 微信支付  ¥45.72 │
│  住宿  ...                                          ...   ¥1234.56 │
│  高铁  ...                                          ...   ¥150.00 │
│  机票  ...                                          ...   ¥100.00 │
├─────────────────────────────────────────────────────────┤
│  总计                                              ¥21708 │
└─────────────────────────────────────────────────────────┘
```

**可观察模式**：
- 顶部 4 个类别 tab（高铁/机票/打车/住宿）—— 当前过滤器
- 每行 `类别` 列靠文字描述区分（站点名/机场名/酒店名/地址对）
- 金额集中在右列，格式 `¥\d+\.\d{2}`

---

## 3. 决策记录

| # | 决策点 | 选择 | 理由 |
|---|--------|------|------|
| 1 | 输入方式 | **文件选择对话框 + 原生拖拽**（不做剪贴板粘贴） | 与现有 `pickPdfs` 入口一致；截图先存盘再拖入符合桌面端习惯 |
| 2 | OCR 引擎 | **本地 Tesseract**（非云端） | 报销数据敏感；零 API key 与持续成本；功能边界收缩后准确率足够 |
| 3 | 命令集成 | **复用 `recognize_invoices`，按扩展名分流** | 零新增命令、零新增记录类型、汇总/预览自动复用 |
| 4 | 字段粒度 | **仅 type + amount** | 标题/日期在 OCR 噪声下识别率低；金额数字 Tesseract 准确率最高（>95%）；金额是报销单关键字段 |
| 5 | 未识别记录 | **type=unknown（与 PDF 路径一致）** | 用户可在 RightPanel 手动调整；不静默丢数据 |
| 6 | 支持的类别 | 打车 / 住宿 / 机票 / 高铁 4 类（图片里出现的全识别） | 类别用标题文字模式推断（站点名→高铁、机场→机票等） |
| 7 | 单图多记录 | **支持**（一张图可产 N 条记录） | 与 PDF「单页单记录」不同范式；按行解析 + 按金额定位 |

---

## 4. 架构设计

### 4.1 后端模块

新增 `src-tauri/src/services/ocr_service.rs`：

```rust
/// 图像预处理 + Tesseract OCR，返回 (page_num, text, boxes) 三元组列表。
/// 图像视为单页（page_num=1）。
pub fn extract_text_with_layout(path: &str) -> Result<OcrPage, AppError>;

pub struct OcrPage {
    pub text: String,        // 全文（拼接所有 word）
    pub words: Vec<OcrWord>, // 词级别位置信息，用于行/列定位
}

pub struct OcrWord {
    pub text: String,
    pub x: i32, pub y: i32,
    pub w: i32, pub h: i32,
    pub confidence: f64,
}
```

修改 `src-tauri/src/commands/recognition.rs::recognize_invoices`：

```rust
for path in file_paths {
    let ext = Path::new(path).extension()?.to_lowercase();
    let pages: Vec<(u32, String, Vec<OcrWord>)> = match ext.as_str() {
        "pdf"  => pdf_service::extract_text_by_page(path)?.into(),
        "png" | "jpg" | "jpeg" => {
            let page = ocr_service::extract_text_with_layout(path)?;
            vec![(1, page.text, page.words)]
        }
        _ => continue,
    };

    for (page_num, page_text, words) in pages {
        let (invoice_type, from_qr) = detect_invoice_type(&page_text, &[], &rules);
        if invoice_type != "unknown" {
            // PDF 单页单记录路径
            // ... 现有逻辑 ...
        } else {
            // 图片兜底：按行解析携程商旅列表
            for (kind, amount) in parse_travel_screenshot(&words) {
                // 各产一条 InvoiceRecord，type 字段填 kind
            }
        }
    }
}
```

修改 `src-tauri/src/services/recognition_service.rs`，新增：

```rust
/// 从携程商旅 App 截图的 OCR 词列表提取 (category, amount) 对。
/// 策略：定位所有金额（数字 + 邻近 ¥/小数字），向上找最近的类别提示词。
pub fn parse_travel_screenshot(words: &[OcrWord]) -> Vec<(String, f64)>;
```

### 4.2 类别推断规则

`parse_travel_screenshot` 内部优先级：

| 类别 | 推断信号 |
|------|----------|
| `train` | 含「高铁」/「动车」/ `XX站` - `XX站` 模式 |
| `flight` | 含「机票」/「航班」/ `XX机场` - `XX机场` 模式 |
| `hotel` | 含「酒店」/「住宿」/ `XX酒店` / 知名酒店集团关键词 |
| `car` | 含「打车」/「用车」/「滴滴」/「出租」 或以上都不命中时的兜底 |
| `unknown` | 金额=0 或无任何信号 |

实现为优先级链，第一条命中即返回。详见 §6 测试样例。

### 4.3 前端改动

修改 [src/lib/tauri.ts](file:///c:/Users/SanXiaoXing/Desktop/Code/snap-claim-rs/src/lib/tauri.ts)：

```ts
// 原 pickPdfs 改为支持图片；语义不再限于 PDF
export async function pickInputFiles(): Promise<string[]> {
    const sel = await openDialog({
        multiple: true,
        filters: [
            { name: 'PDF / 图片', extensions: ['pdf', 'png', 'jpg', 'jpeg'] },
        ],
    })
    return Array.isArray(sel) ? sel : sel ? [sel] : []
}
```

修改 [src/App.tsx](file:///c:/Users/SanXiaoXing/Desktop/Code/snap-claim-rs/src/App.tsx)：
- `handleAddFiles` 调用 `pickInputFiles` 替代 `pickPdfs`
- 文件去重、状态提示文案调整

修改 [src/components/Panels.tsx](file:///c:/Users/SanXiaoXing/Desktop/Code/snap-claim-rs/src/components/Panels.tsx)：
- 「添加 PDF 文件」按钮 → 「添加 PDF / 图片」
- 文件列表项为图片类型时显示 📷 图标（CSS class 区分，不引第三方图标库）

修改 [src/components/Panels.tsx](file:///c:/Users/SanXiaoXing/Desktop/Code/snap-claim-rs/src/components/Panels.tsx) 中文件过滤：

```ts
// 原: p.paths.filter((f) => f.toLowerCase().endsWith('.pdf'))
// 改: p.paths.filter((f) => /\.(pdf|png|jpe?g)$/i.test(f))
```

### 4.4 资源与配置

**新增依赖**（[src-tauri/Cargo.toml](file:///c:/Users/SanXiaoXing/Desktop/Code/snap-claim-rs/src-tauri/Cargo.toml)）：

```toml
tesseract = "0.15"  # Tesseract C++ binding
image = "0.25"      # 图像预处理（可选，二值化/放大）
```

**新增资源**：
- `src-tauri/resources/tessdata/chi_sim.traineddata`（约 25MB，下载自 [tesseract-ocr/tessdata](https://github.com/tesseract-ocr/tessdata)）
- `src-tauri/resources/tesseract/`（Windows：libtesseract-5.dll + 相关依赖；macOS：自建 framework；Linux：系统包）

**tauri.conf.json** 资源声明：

```json
"bundle": {
    "resources": {
        "resources/pdfium.dll": "resources/pdfium.dll",
        "resources/tessdata/": "resources/tessdata/"
    }
}
```

**Capabilities**：无需新增权限。OCR 在后端进程内完成，不涉及文件系统/网络额外权限。

---

## 5. 数据流

```
[用户操作]
   │
   ├── 拖图片/PDF 到窗口 ──┐
   │                       │
   └── 点「添加 PDF / 图片」按钮 ──→ pickInputFiles() 选文件
                                   │
                                   ▼
                            [files: string[]]
                                   │
                  ┌────────────────┴────────────────┐
                  ▼                                  ▼
            点「开始识别」                       onDragDropEvent
                  │                                  │
                  └────────────────┬─────────────────┘
                                   ▼
                  invoke('recognize_invoices', {
                      filePaths, days, existingRecords
                  })
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
        .pdf 路径           .png/.jpg 路径         .pdf 路径（增量）
        pdfium 抽文本       tesseract OCR           跳过（已识别）
              │                    │
              ▼                    ▼
        现有 detect +         parse_travel_screenshot
        extract_fields         → Vec<(type, amount)>
              │                    │
              └─────────┬──────────┘
                        ▼
                  Vec<InvoiceRecord>
                        │
                        ▼
              expense_calculator 汇总/预览
                        │
                        ▼
                  emit 到前端，渲染
```

---

## 6. TDD 测试计划

按 TDD 原则：**行为驱动、垂直切片、先 tracer bullet**。

### 6.1 行为清单（按优先级）

| 优先级 | 行为 | 验证点 |
|--------|------|--------|
| P0 | 携程截图输入后产出 N 条 `InvoiceRecord` | N 与图中金额数一致；每条 amount > 0 |
| P0 | 类别推断：高铁路由识别为 `train` | 标题含「XX站-XX站」→ train |
| P0 | 类别推断：机票航段识别为 `flight` | 标题含「XX机场-YY机场」→ flight |
| P0 | 类别推断：酒店条目识别为 `hotel` | 标题含「酒店」→ hotel |
| P0 | 类别推断：打车条目识别为 `car` | 标题含「打车/滴滴/出租」→ car |
| P1 | 未知类型条目产出 `type=unknown` | 不静默丢数据；金额仍可读 |
| P1 | 混合输入（PDF + 图片）一次性识别 | records 合并正确，types 共存 |
| P1 | 图片文件参与 totals 汇总 | 现有 `calc_totals` 直接支持（无侵入） |
| P2 | 文件选择对话框 filters 含图片扩展名 | 前端 unit test |
| P2 | 拖拽接受图片文件 | 前端 unit test |

### 6.2 Tracer Bullet

**第 1 个测试**（最小端到端）：

```rust
#[test]
fn recognizes_two_car_and_one_hotel_entries_from_screenshot_ocr() {
    // 给定：模拟 OCR 输出的 words 列表，对应携程截图
    let words = mock_ctrip_screenshot_words();

    // 当：调用 parse_travel_screenshot
    let records = parse_travel_screenshot(&words);

    // 那么：返回 3 条记录
    assert_eq!(records.len(), 3);
    // 打车金额 (含 ¥45.72)
    assert!(records.iter().any(|r| r.kind == "car" && (r.amount.unwrap() - 45.72).abs() < 0.01));
    // 酒店金额 (含 ¥1234.56)
    assert!(records.iter().any(|r| r.kind == "hotel" && (r.amount.unwrap() - 1234.56).abs() < 0.01));
    // 类型按 infer 顺序：默认兜底为 car
}
```

实现到位后，逐项添加 P0/P1 行为测试。

### 6.3 测试文件位置

- `src-tauri/src/services/recognition_service.rs` 内 `#[cfg(test)] mod tests`
  - `parse_travel_screenshot` 各类别推断单元测试
  - 金额提取回归测试（与现有 `extract_amount` 行为对齐）
- `src-tauri/src/services/ocr_service.rs` 内 `#[cfg(test)] mod tests`
  - 真实样例图 OCR 黄金测试（CI 跑通即视为识别通过）
  - **首次提交时需附带 1-2 张脱敏样例图作为 fixture**
- `src/components/Panels.test.tsx`（**新建**）
  - 文件列表项渲染
  - 图片扩展名高亮

---

## 7. 实施路线图

按 ponytail 原则：最小可工作版本 → 验证 → 再扩展。

### Phase 1：本地 OCR + 类别推断（最小可用）

- [ ] 集成 tesseract + 下载 chi_sim.traineddata
- [ ] 实现 `ocr_service::extract_text_with_layout`
- [ ] 实现 `parse_travel_screenshot`（类别推断 + 金额定位）
- [ ] 改造 `recognize_invoices` 按扩展名分流
- [ ] 前端 pickInputFiles + 拖拽过滤
- [ ] P0 行为全部覆盖测试
- [ ] 用真实截图跑通端到端

### Phase 2：图像预处理（准确率优化，可选）

- [ ] 二值化 + 2x 放大（`image` crate）
- [ ] confidence < 60 的 word 标记为「未确认」
- [ ] 与 Phase 1 对比：未确认 word 是否集中出现在数字/标点

### Phase 3：多 App 适配（v2 议题）

- [ ] 抽象 `TravelAppParser` trait
- [ ] 携程 / 去哪儿 / 飞猪 各自实现
- [ ] 按截图特征自动选 parser（顶部 logo OCR / 关键词匹配）

### Phase 4：字段扩展（v2 议题）

- [ ] 增加起止日期、起止地点等字段
- [ ] 评估是否引入云端 OCR 兜底

---

## 8. 风险与开放问题

| 风险 | 影响 | 缓解 |
|------|------|------|
| Tesseract 对手机截图小字识别率 < 80% | 类别推断错误增多 | Phase 2 预处理；Phase 1 先用 `unknown` 兜底 |
| 携程 App 改版导致布局变 | 类别推断全面失效 | 在 recognizer 加 layout signature 校验；改版时一次更新 `parse_travel_screenshot` |
| 25MB 中文模型显著增加安装包体积 | 用户下载/更新成本 | 单独打 `lite` 安装包（不含 tessdata，用户按需下载） |
| 截图中混有非订单文本（导航栏、广告） | 误识别 | 按 Y 坐标限定在「订单列表区」（顶部 tabs 之下、合计行之上） |
| 多账号/多人截图混排 | 金额与类别错配 | 暂不支持；UI 提示「请确保截图仅含本人订单」 |

---

## 9. 涉及文件清单

### 修改

- [src-tauri/Cargo.toml](file:///c:/Users/SanXiaoXing/Desktop/Code/snap-claim-rs/src-tauri/Cargo.toml) — 新增 `tesseract`、`image` 依赖
- [src-tauri/src/commands/recognition.rs](file:///c:/Users/SanXiaoXing/Desktop/Code/snap-claim-rs/src-tauri/src/commands/recognition.rs) — `recognize_invoices` 按扩展名分流
- [src-tauri/src/services/recognition_service.rs](file:///c:/Users/SanXiaoXing/Desktop/Code/snap-claim-rs/src-tauri/src/services/recognition_service.rs) — 新增 `parse_travel_screenshot`
- [src-tauri/src/error.rs](file:///c:/Users/SanXiaoXing/Desktop/Code/snap-claim-rs/src-tauri/src/error.rs) — 新增 `Ocr(String)` 错误变体
- [src-tauri/tauri.conf.json](file:///c:/Users/SanXiaoXing/Desktop/Code/snap-claim-rs/src-tauri/tauri.conf.json) — 资源声明新增 tessdata
- [src/lib/tauri.ts](file:///c:/Users/SanXiaoXing/Desktop/Code/snap-claim-rs/src/lib/tauri.ts) — `pickPdfs` → `pickInputFiles`
- [src/App.tsx](file:///c:/Users/SanXiaoXing/Desktop/Code/snap-claim-rs/src/App.tsx) — 文件入参改名 + 状态文案
- [src/components/Panels.tsx](file:///c:/Users/SanXiaoXing/Desktop/Code/snap-claim-rs/src/components/Panels.tsx) — 按钮文案 + 拖拽过滤 + 图片标识

### 新增

- `src-tauri/src/services/ocr_service.rs`
- `src-tauri/src/services/ocr_service.rs` 内单元测试 + 1-2 张脱敏 fixture 图
- `src-tauri/resources/tessdata/chi_sim.traineddata`（提交到 Git LFS 或下载脚本）
- `src/components/Panels.test.tsx`

### 不动

- `models/`、`config/rules.yaml`、`expense_calculator.rs` —— 图片识别直接复用 `InvoiceRecord` 类型与汇总逻辑
- `excel_service.rs` —— 输出格式不变
- `update.rs`、菜单、About 弹窗 —— 与本功能正交

---

## 10. 一句话总结

> 复用 `recognize_invoices` 命令按后缀分流，图片走本地 Tesseract OCR，解析携程商旅 App 截图为 type+amount 二元组列表，按 4 类关键词（站点/机场/酒店/打车）推断类别，未识别走 `unknown` 兜底，最终与 PDF 记录一并汇总入现有报销单。
