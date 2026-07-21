// SnapClaim 本地 OCR 规范化模型（docs/LOCAL_OCR_SPEC.md §11）
// 应用拥有自己的归一化模型，不把 PaddleOCR.js 原始结果直接暴露给业务层。

export interface Point {
  x: number;
  y: number;
}

export interface OcrTextBlock {
  id: string;
  text: string;
  confidence: number;
  polygon: Point[];
}

export interface OcrDocument {
  width: number;
  height: number;
  blocks: OcrTextBlock[];
  rawText: string;
  durationMs: number;
}

// —— PaddleOCR.js v0.4.2 原始结果（OcrResult）的本地镜像 ——
// poly 形状在 SDK 文档中未明确示意，可能是 [[x,y],...] 或扁平 [x1,y1,...]，
// 归一化时两种都兼容（外部库边界，做防御性解析）。
export interface RawOcrItem {
  text: string;
  score: number;
  poly: number[] | number[][];
}

export interface RawOcrMetrics {
  detMs?: number;
  recMs?: number;
  totalMs?: number;
  detectedBoxes?: number;
  recognizedCount?: number;
}

export interface RawOcrResult {
  image: { width: number; height: number };
  items: RawOcrItem[];
  metrics?: RawOcrMetrics;
}

// —— OCR 错误模型（docs/LOCAL_OCR_SPEC.md §25）——
export enum OcrErrorCode {
  InitializationFailed = "initialization_failed",
  InvalidInput = "invalid_input",
  InferenceFailed = "inference_failed",
  ResultParseFailed = "result_parse_failed",
}

export class OcrError extends Error {
  constructor(public code: OcrErrorCode, message?: string) {
    super(message ?? code);
    this.name = "OcrError";
  }
}

// —— OCR 引擎抽象（业务层不直接依赖 PaddleOCR.js，§4.3）——
export interface OcrService {
  initialize(): Promise<void>;
  recognize(input: Blob | File): Promise<OcrDocument>;
  dispose(): Promise<void>;
}
