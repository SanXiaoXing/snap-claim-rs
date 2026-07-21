/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // PaddleOCR.js Worker 模式：SDK 用 new Worker(url, { type: "module" }) 加载 worker entry，
  // Vite 需显式声明 worker 打包为 ES module 格式，否则 worker 内 import 会失败。
  worker: {
    format: "es",
  },

  // PaddleOCR.js 用 new URL("./assets/worker-entry-*.js", import.meta.url) 加载 Worker，
  // 这类 URL 导入的资产不应进 dep optimizer（optimizeDeps 只处理 ESM 入口，不处理资产）。
  // 不排除会导致 Vite 尝试预打包 worker entry 并报 "file does not exist in optimize deps directory"。
  // 但其内部依赖（onnxruntime-web/opencv-js/clipper-lib/js-yaml）需要预打包才能在浏览器正确加载。
  optimizeDeps: {
    exclude: ["@paddleocr/paddleocr-js"],
    include: [
      "onnxruntime-web",
      "@techstark/opencv-js",
      "clipper-lib",
      "js-yaml",
    ],
  },

  // ponytail: vitest 复用 vite 配置，jsdom 环境跑 React 组件测试
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
