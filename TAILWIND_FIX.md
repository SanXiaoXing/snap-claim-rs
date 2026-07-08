pnpm 依赖管理在 Tailwind v4 下有问题。改用 npm：

```powershell
cd c:\Users\SanXiaoXing\Desktop\Code\Invoice-OCR\snap-claim-rs
# 删除 pnpm 相关文件
Remove-Item pnpm-lock.yaml, pnpm-workspace.yaml -ErrorAction SilentlyContinue
# 删除 node_modules（可选，npm install 会覆盖）
# Remove-Item -Recurse -Force node_modules
# 用 npm 安装所有依赖
npm install
npm run dev
```

npm 会自动安装 Tailwind v4 的所有嵌套依赖（@tailwindcss/postcss、@tailwindcss/node、@alloc/quick-lru 等），无需手动干预。