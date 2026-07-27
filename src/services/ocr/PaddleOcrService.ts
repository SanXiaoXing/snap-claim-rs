import { PaddleOCR } from "@paddleocr/paddleocr-js";

import { normalizeOcrResult } from "./normalize";
import { OcrError, OcrErrorCode } from "./types";
import type { OcrDocument, OcrService, RawOcrResult } from "./types";

/// PaddleOCR.js 适配器：封装 create + predict，归一化为 OcrDocument。
/// 懒初始化（docs/LOCAL_OCR_SPEC.md §16），并支持并发 initialize 去重。
export class PaddleOcrService implements OcrService {
  private runner: PaddleOCR | null = null;
  private initializing: Promise<PaddleOCR> | null = null;

  async initialize(): Promise<void> {
    if (this.runner) return;
    if (this.initializing) {
      await this.initializing;
      return;
    }
    this.initializing = this.createRunner();
    try {
      this.runner = await this.initializing;
    } finally {
      this.initializing = null;
    }
  }

  async recognize(input: Blob | File): Promise<OcrDocument> {
    await this.initialize();
    if (!this.runner) {
      throw new OcrError(OcrErrorCode.InitializationFailed, "OCR 引擎未初始化");
    }

    let results: RawOcrResult[];
    try {
      results = await this.runner.predict(input);
    } catch (e) {
      throw new OcrError(
        OcrErrorCode.InferenceFailed,
        e instanceof Error ? e.message : String(e),
      );
    }

    if (!results || results.length === 0) {
      throw new OcrError(OcrErrorCode.ResultParseFailed, "OCR 返回空结果");
    }
    return normalizeOcrResult(results[0]);
  }

  async dispose(): Promise<void> {
    await this.runner?.dispose();
    this.runner = null;
    this.initializing = null;
  }

  private async createRunner(): Promise<PaddleOCR> {
    try {
      // Worker 模式：OCR 推理放到独立 Worker，避免阻塞 Tauri WebView 主线程。
      // 模型文件从本地加载（public/models/），WASM 文件从本地加载（public/wasm/），
      // 确保打包后离线可用，不依赖远程 CDN。
      // 显式指定模型名和本地资产路径，不依赖 lang/ocrVersion 的默认 CDN 下载。
      const ocr = await PaddleOCR.create({
        worker: true,
        textDetectionModelName: "PP-OCRv5_mobile_det",
        textDetectionModelAsset: {
          url: new URL("/models/PP-OCRv5_mobile_det_onnx_infer.tar", window.location.origin).href,
        },
        textRecognitionModelName: "PP-OCRv5_mobile_rec",
        textRecognitionModelAsset: {
          url: new URL("/models/PP-OCRv5_mobile_rec_onnx_infer.tar", window.location.origin).href,
        },
        ortOptions: {
          backend: "wasm",
          wasmPaths: new URL("/wasm/", window.location.origin).href,
        },
      });
      return ocr as unknown as PaddleOCR;
    } catch (e) {
      throw new OcrError(
        OcrErrorCode.InitializationFailed,
        e instanceof Error ? e.message : String(e),
      );
    }
  }
}
