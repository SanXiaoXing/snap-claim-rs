import { describe, it, expect } from "vitest";
import { normalizeOcrResult } from "./normalize";
import type { RawOcrResult } from "./types";

describe("normalizeOcrResult", () => {
  it("单个文本块归一化为 OcrDocument", () => {
    const raw: RawOcrResult = {
      image: { width: 1920, height: 1080 },
      items: [
        { text: "电子发票", score: 0.98, poly: [[100, 100], [500, 100], [500, 150], [100, 150]] },
      ],
      metrics: { totalMs: 530 },
    };

    const doc = normalizeOcrResult(raw);

    expect(doc.width).toBe(1920);
    expect(doc.height).toBe(1080);
    expect(doc.durationMs).toBe(530);
    expect(doc.blocks).toHaveLength(1);
    expect(doc.blocks[0].text).toBe("电子发票");
    expect(doc.blocks[0].confidence).toBe(0.98);
    expect(doc.rawText).toBe("电子发票");
  });

  it("多个文本块按顺序编号并换行拼接 rawText", () => {
    const raw: RawOcrResult = {
      image: { width: 800, height: 600 },
      items: [
        { text: "第一行", score: 0.9, poly: [[0, 0], [1, 0], [1, 1], [0, 1]] },
        { text: "第二行", score: 0.8, poly: [[0, 0], [1, 0], [1, 1], [0, 1]] },
        { text: "第三行", score: 0.7, poly: [[0, 0], [1, 0], [1, 1], [0, 1]] },
      ],
    };

    const doc = normalizeOcrResult(raw);

    expect(doc.blocks).toHaveLength(3);
    expect(doc.blocks.map((b) => b.id)).toEqual(["block-001", "block-002", "block-003"]);
    expect(doc.rawText).toBe("第一行\n第二行\n第三行");
  });

  it("扁平 poly [x1,y1,...] 同样归一化为 polygon 顶点", () => {
    const raw: RawOcrResult = {
      image: { width: 100, height: 100 },
      items: [
        { text: "t", score: 0.5, poly: [10, 20, 30, 20, 30, 40, 10, 40] },
      ],
    };

    const doc = normalizeOcrResult(raw);

    expect(doc.blocks[0].polygon).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 20 },
      { x: 30, y: 40 },
      { x: 10, y: 40 },
    ]);
  });

  it("空 items 产生空 rawText 与 blocks；缺 metrics 时 durationMs 为 0", () => {
    const raw: RawOcrResult = {
      image: { width: 50, height: 50 },
      items: [],
    };

    const doc = normalizeOcrResult(raw);

    expect(doc.blocks).toEqual([]);
    expect(doc.rawText).toBe("");
    expect(doc.durationMs).toBe(0);
  });
});
