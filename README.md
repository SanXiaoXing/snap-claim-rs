<div align="center">

<img src="public/20260709.png" alt="SnapClaim" width="120">

<h1>SnapClaim</h1>

<p>专治各种"纸质单据 PTSD"</p>

</div>

所在的公司还在用上个世纪的报销手段，填单靠手写，审核靠肉眼，一个数字写错了就得从头再来。与其寄希望于流程改革，不如先让自己算得明明白白。

本项目是一个 Tauri 桌面应用，无网络依赖，数据仅存本地。你只需录入支出项目，它自动计算总和、分类统计，并支持导出为标准化清单。从此提交报销，心里有底，财务不逼逼。

## 功能

- 支持 PDF 文件拖拽/批量添加
- 自动识别电子发票二维码信息
- 支持出行确认单（车票、机票、酒店单）
- 一键生成 Excel 报销单
- 跨平台：Windows / macOS / Linux

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run tauri dev

# 生产构建
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/`。

Windows 用户：首次构建会静态编译 pdfium，需 cmake 和 Visual Studio。

## 使用说明

1. 点击「添加 PDF 文件」或拖拽文件导入
2. 选择需要处理的文件（多选支持）
3. 点击「识别」提取发票信息
4. 选择日期范围
5. 点击「导出报告」生成 Excel

## 项目结构

```
snap-claim-rs/
├─ src/                # 前端 React 代码
│  ├─ components/      # UI 组件
│  ├─ lib/             # 工具函数
│  ├─ styles/          # TailwindCSS
│  └─ types/           # TypeScript 类型
├─ src-tauri/          # 后端 Rust 代码
│  ├─ commands/        # Tauri 命令
│  ├─ services/        # 业务逻辑
│  │  ├─ pdf_service.rs      # PDF 解析
│  │  ├─ recognition_service.rs # 二维码识别
│  │  └─ excel_service.rs    # Excel 生成
│  ├─ config/          # 规则配置
│  └─ utils/           # 工具函数
└─ docs/               # 文档
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React + TypeScript + Vite + TailwindCSS + GSAP |
| 后端 | Rust + Tauri 2 |
| PDF 解析 | pdfium-render (静态编译) |
| 二维码识别 | rxing |
| Excel 生成 | rust_xlsxwriter |
| 动画 | GSAP (磁吸效果、入场动画) |

## 开发依赖

- Node.js 18+
- Rust 1.70+
- cmake (pdfium 静态编译)
- Visual Studio Build Tools (Windows)

## 配置文件

发票识别规则位于 `src-tauri/src/config/rules.yaml`，可自定义：

- 发票类型映射
- 字段提取规则
- 费用计算逻辑

## IDE 推荐

- [VS Code](https://code.visualstudio.com/)
- [Tauri 插件](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## 常见问题

**Q: 构建时报 `LoadLibraryExW` 错误？**

A: pdfium DLL 未打包。确保 Cargo.toml 使用 `pdfium-render = { version = "0.8", features = ["static"] }`。

**Q: 图标显示异常？**

A: 运行 `npx tauri icon <源图路径>` 重新生成所有尺寸。

## Authors

[SanXiaoXing](https://github.com/SanXiaoXing)

---
## 特别感谢

优质的 idea 源自 [RandomJinJin](https://github.com/RandomJinJin)。
