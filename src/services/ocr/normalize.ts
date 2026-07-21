import type { OcrDocument, OcrTextBlock, Point, RawOcrResult } from "./types";

/// 把 PaddleOCR.js 的原始 OcrResult 归一化为 SnapClaim 的 OcrDocument。
export function normalizeOcrResult(raw: RawOcrResult): OcrDocument {
  const blocks: OcrTextBlock[] = raw.items.map((item, i) => ({
    id: `block-${String(i + 1).padStart(3, "0")}`,
    text: item.text,
    confidence: item.score,
    polygon: toPoints(item.poly),
  }));

  return {
    width: raw.image.width,
    height: raw.image.height,
    blocks,
    rawText: raw.items.map((i) => i.text).join("\n"),
    durationMs: raw.metrics?.totalMs ?? 0,
  };
}

/// poly 兼容两种形状：[[x,y],...] 配对 / [x1,y1,...,x4,y4] 扁平。
function toPoints(poly: number[] | number[][]): Point[] {
  if (poly.length === 0) return [];
  // 扁平：首个元素是 number
  if (typeof poly[0] === "number") {
    const flat = poly as number[];
    const pts: Point[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) pts.push({ x: flat[i], y: flat[i + 1] });
    return pts;
  }
  return (poly as number[][]).map(([x, y]) => ({ x, y }));
}
