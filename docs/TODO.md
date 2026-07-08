# SnapClaim 重构 TODO

## 已完成

### Rust 后端 (`src-tauri/src/`)

- [x] **项目结构**：`commands/`、`models/`、`services/`、`utils/`、`config/` 模块划分
- [x] **数据模型** (`models/mod.rs`)：`InvoiceRecord`、`Totals`、`PreviewRow`、`RecognitionResult` 强类型结构体，与前端 TypeScript 类型对齐
- [x] **识别规则** (`config/rules.yaml` + `config/mod.rs`)：从 Python 项目迁移的 5 类发票识别规则（火车票、酒店、用车、机票、发票），YAML 嵌入编译
- [x] **规则引擎** (`services/recognition_service.rs`)：基于正则的发票类型检测 + 字段提取 + 金额提取
- [x] **费用计算** (`services/expense_calculator.rs`)：费用汇总、报销单预览行生成（对齐 Python 的 `expense_calculator.py`）
- [x] **结果格式化** (`services/result_formatter.rs`)：识别结果格式化，含类型中文标签
- [x] **中文金额大写** (`utils/amount_converter.rs`)：数值转中文大写金额（与 Python 逻辑一致）
- [x] **Tauri 命令** (`commands/recognition.rs`)：`recognize_invoices` 命令，接收文件路径列表 + 出差天数，返回完整识别结果，支持进度事件推送
- [x] **错误处理** (`error.rs`)：`AppError` 枚举，支持 serde 序列化返回前端
- [x] **Tauri 插件**：`dialog`、`fs`、`shell`、`store`、`opener` 已注册
- [x] **Capabilities 权限**：`default.json` 已配置所有插件权限

### 前端 (`src/`)

- [x] **Tauri API 封装** (`src/lib/tauri.ts`)：`pickPdfs()` 原生文件选择、`recognizeInvoices()` 识别命令 + 进度事件监听
- [x] **App 主流程** (`src/App.tsx`)：文件选择 → 识别 → 结果展示 完整流程，连接真实 Rust 后端
- [x] **组件更新** (`src/components/Panels.tsx`)：文件删除传参优化、进度条按文件数显示
- [x] **类型定义** (`src/types/index.ts`)：添加 `RecognitionResult`，与 Rust serde 序列化对齐
- [x] **TailwindCSS v4 + Vite 配置**：端口修正为 1420，npm 切换（pnpm 兼容性问题）
- [x] **5 套主题**：基于 CSS 变量的主题切换保留

---

## 待完成

### 核心功能

- [ ] **PDF 文本提取**：当前 `extract_pdf_text` 返回空，需接入 `pdf-extract` crate，按页提取文本
- [ ] **二维码金额识别**：高铁票 / 发票二维码中的价税合计金额识别，需接入 `quircs` + `image` crate
- [ ] **实际识别测试**：用真实 PDF 文件跑通完整识别流程，调试规则匹配

### 导出功能

- [ ] **Excel 报销单导出**：接入 `rust_xlsxwriter`，生成对齐 Python 版格式的报销单
- [ ] **合并 PDF**：接入 `pdf` + `pdf-writer` crate，实现 PDF 合并

### UI 完善

- [ ] **拖拽文件**：当前前端的 onDrop 仅获取文件名，需接入 Tauri 原生拖拽（`tauri-plugin-drag-drop`）
- [ ] **识别结果手动编辑**：RightPanel 内可编辑识别结果字段
- [ ] **历史记录**：使用 `tauri-plugin-store` 持久化识别历史

### 工程化

- [ ] **Nuitka → Tauri 打包**：`nuitka` 打包命令替换为 `tauri build`，配置 `--windows-company-name`、`--windows-product-name` 等
- [ ] **日志系统**：接入 `tracing` 文件输出，按日期命名日志文件（对齐 Python 的日志规范）
- [ ] **CI/CD**：配置 GitHub Actions 自动构建 Windows 安装包