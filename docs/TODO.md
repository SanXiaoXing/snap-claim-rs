# SnapClaim 重构 TODO

## 已完成

### Rust 后端 (`src-tauri/src/`)

- [x] **项目结构**：`commands/`、`models/`、`services/`、`utils/`、`config/` 模块划分
- [x] **数据模型** (`models/mod.rs`)：`InvoiceRecord`、`Totals`、`PreviewRow`、`RecognitionResult` 强类型结构体，与前端 TypeScript 类型对齐
- [x] **识别规则** (`config/rules.yaml` + `config/mod.rs`)：从 Python 项目迁移的 5 类发票识别规则（火车票、酒店、用车、机票、发票），YAML 嵌入编译
- [x] **规则引擎** (`services/recognition_service.rs`)：基于正则的发票类型检测 + 字段提取 + 金额提取
- [x] **费用计算** (`services/expense_calculator.rs`)：费用汇总、报销单预览行生成（对齐 Python 的 `expense_calculator.py`）
- [x] **中文金额大写** (`utils/amount_converter.rs`)：数值转中文大写金额（与 Python 逻辑一致）
- [x] **Tauri 命令** (`commands/recognition.rs`)：`recognize_invoices` 命令，接收文件路径列表 + 出差天数，返回完整识别结果，支持进度事件推送
- [x] **错误处理** (`error.rs`)：`AppError` 枚举，支持 serde 序列化返回前端（含 `PdfParse`、`QrRead`、`Io`、`RulesLoad`、`ExcelExport`、`Cancelled`）
- [x] **Tauri 插件**：`tauri-plugin-dialog` 已注册（按需保留，移除未使用的 fs/shell/store/opener）
- [x] **Capabilities 权限**：`default.json` 配置 `core:default` + `dialog:default`

### PDF 处理 (`services/pdf_service.rs`)

- [x] **PDF 文本提取**：`extract_text_by_page` 接入 `pdfium-render`，按页提取文本（替代原计划的 `pdf-extract`）
- [x] **二维码识别**：`extract_qr_codes` 接入 `rxing`（替代原计划的 `quircs` + `image`），多分辨率渲染（3000/2000/4000px）提高检出率
- [x] **二维码金额提取**：`extract_amount_from_qr` 解析 `etripCar://`、`etripHotel://`、`etrip://` 协议头，按类型取对应字段金额
- [x] **PDF 合并**：`merge_pdfs` 接入 `pdfium-render`（替代原计划的 `pdf + pdf-writer`），按入参顺序拼接所有页面

### 识别能力 (`services/recognition_service.rs`)

- [x] **确认函类型识别**：文本含「确认函」时通过二维码协议头区分机票/酒店/用车
- [x] **火车票站名/车次解析**：兼容三种 pdfium 抽取格式——站名车次同行、两站名同行+独立车次行、老式报销凭证三行结构
- [x] **金额提取多策略**：优先二维码金额 → 文本正则（价税合计/实付金额/费用合计等 8 种模式）
- [x] **实际识别测试**：用真实 PDF 跑通完整识别流程，调试规则匹配

### 导出功能

- [x] **Excel 报销单导出** (`services/excel_service.rs`)：接入 `rust_xlsxwriter`，表头加粗、合计行加粗、固定列宽防中文截断，9 列与前端表格严格对齐
- [x] **合并 PDF 命令** (`commands/pdf.rs`)：`merge_pdfs` Tauri 命令，前端调用 + 原生 save 对话框选输出路径
- [x] **导出 Excel 命令** (`commands/excel.rs`)：`export_excel` Tauri 命令

### 前端 (`src/`)

- [x] **Tauri API 封装** (`src/lib/tauri.ts`)：`pickPdfs()`、`pickSavePath()`、`recognizeInvoices()`、`mergePdfs()`、`exportExcel()` + 进度/记录事件监听
- [x] **App 主流程** (`src/App.tsx`)：文件选择 → 识别 → 结果展示 完整流程，连接真实 Rust 后端
- [x] **增量识别**：已识别文件不重跑，后端只解析新增 PDF，days 变化时用现有 records 重算汇总（250ms debounce）
- [x] **组件更新** (`src/components/Panels.tsx`)：识别结果表 + 报销单预览表，各列最大宽度防截断
- [x] **类型定义** (`src/types/index.ts`)：添加 `RecognitionResult`，与 Rust serde 序列化对齐
- [x] **拖拽文件**：接入 Tauri 原生 `onDragDropEvent`（替代 HTML5 ondrop，避免 .path 非标准问题），含拖拽掩码提示
- [x] **原生菜单栏** (`src-tauri/src/lib.rs`)：文件/导出/主题/帮助四组菜单，后端 emit id → 前端按 id 分发
- [x] **出差日期日历** (`src/components/DateRangeModal.tsx`)：日期区间选择，days 由日期差派生（+1 含首尾）
- [x] **TailwindCSS v4 + Vite 配置**：端口修正为 1420，npm 切换（pnpm 兼容性问题）
- [x] **5 套主题**：基于 CSS 变量的主题切换保留，菜单栏可切换

---

## 待完成

### UI 完善

- [ ] **识别结果手动编辑**：RightPanel 识别结果表当前只读，需支持字段内编辑（金额、车次、日期等）
- [ ] **历史记录**：使用 `tauri-plugin-store` 持久化识别历史，支持回看历史报销单

### 用车记录批量分类（双态勾选方案）

- [x] **交通类型批量分类弹窗**：RightPanel 用车记录提供"批量分类"入口，弹出分类编辑弹窗
  - **设计核心**：先确定要修改成什么，再选择修改哪些（不猜测业务意图，让用户用最少操作完成明确分类，与专业办公软件批量编辑思路一致）
  - **两类映射**：始终只有两类——勾选 / 未勾选，根据顶部选择的交通类型做一次映射
    - 顶部选「市内交通」：勾选 → 市内交通，未勾选 → 往返交通
    - 顶部选「往返交通」：勾选 → 往返交通，未勾选 → 市内交通
  - **顶部单选**：`( ) 市内交通  ( ) 往返交通` 切换当前编辑目标类型
  - **动态提示文案**（避免用户误以为未勾选记录未分类）：
    - 选市内交通时：`请勾选需要归类为"市内交通"的用车记录，未勾选记录将自动归类为"往返交通"。`
    - 选往返交通时：`请勾选需要归类为"往返交通"的用车记录，未勾选记录将自动归类为"市内交通"。`
  - **操作按钮**：`[全选] [反选] [清空]`
    - **反选**用途：用户已勾选多张后想切换到另一类型时，无需重新勾选，依次点击「反选 → 切换顶部类型 → 确定」即可。打车记录较多的报销单上非常省事
  - **操作次数示例**：
    - 全部往返交通（出差）：选往返交通 → 全选 → 确定（3 次）
    - 仅 1 张市内交通：选市内交通 → 勾 1 张 → 确定（其余自动往返）
    - 仅 1 张往返交通：选往返交通 → 勾 1 张 → 确定（其余自动市内）

### 工程化

- [ ] **日志文件输出**：当前 `tracing` 仅控制台输出，需接入 `tracing-appender` 按日期命名日志文件（对齐 Python 的日志规范）
- [ ] **Nuitka → Tauri 打包**：`nuitka` 打包命令替换为 `tauri build`，配置 `bundle.windows` 元数据（`companyName`、`productName` 等）与 pdfium 动态库打包
- [ ] **CI/CD**：配置 GitHub Actions 自动构建 Windows 安装包

### 自动更新（计划 v1.2.0 实现）

采用 **GitHub Releases + Tauri 官方 Updater** 方案，无需自建服务器，维护成本最低。

- [x] **接入 Updater 插件**：`tauri-plugin-updater`（Tauri 2 官方插件），`Cargo.toml` 增加依赖，`lib.rs` 注册 `tauri_plugin_updater::Builder::new()`
- [x] **版本号单一来源**：`tauri.conf.json` 的 `version` 与 `Cargo.toml` 保持一致（当前 1.1.0），前端已通过 `@tauri-apps/api/app` 的 `getVersion()` 动态读取，避免硬编码漂移
- [x] **更新源配置**：`tauri.conf.json` 配置 `plugins.updater.endpoints` 指向 GitHub Releases 的 `latest.json`，`pubkey` 占位待替换
- [x] **客户端更新流程**：启动时 `check_for_update` 命令比对版本 → 发现新版本弹窗（版本号 + 更新内容 + 立即更新/稍后）→ 下载安装包（进度条）→ 安装并重启
  - UpdateDialog 组件用 TDD 覆盖 5 个行为（渲染/立即更新/稍后/进度/无进度），测试在 `src/components/UpdateDialog.test.tsx`
- [x] **GitHub Action 自动发布**：`git tag v1.x.0` → push tag → tauri-action 执行 `tauri build` → 生成安装包 + `latest.json` → 上传到 GitHub Releases
  - 发布流程最终只需 `git tag && git push origin <tag>`
  - `latest.json` 由 tauri-action 自动生成，不手写

#### 上线前必做（用户手动，代码无法代劳）
- [ ] **生成签名密钥对**：`npx @tauri-apps/cli signer generate -w ~/.tauri/snap-claim.key`
  - 公钥写入 [tauri.conf.json](../src-tauri/tauri.conf.json) 的 `plugins.updater.pubkey`（当前为占位符 `REPLACE_WITH_GENERATED_PUBKEY`）
  - 私钥设为 GitHub 仓库 Secret `TAURI_SIGNING_PRIVATE_KEY`，密码设为 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- [ ] **端到端验证**：首次发版后用旧版本客户端实测一次自动更新流程
