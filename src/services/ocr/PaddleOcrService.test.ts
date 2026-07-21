import { beforeEach, describe, expect, it, vi } from "vitest";

// ponytail: mock 整个 PaddleOCR.js 模块，避免在测试中加载 ONNX/OpenCV 运行时。
// fakeRunner 暴露与 PaddleOCR / WorkerBackedPaddleOCR 相同的公共方法（predict/dispose）。
const fakeRunner = {
  predict: vi.fn(),
  dispose: vi.fn(),
};
const createMock = vi.fn(async () => fakeRunner);

vi.mock("@paddleocr/paddleocr-js", () => ({
  PaddleOCR: {
    create: createMock,
  },
}));

// 在每个用例后动态导入，确保 vi.mock 生效；用动态 import 也能让 resetModules 重置模块状态。
const loadService = async () => {
  const mod = await import("./PaddleOcrService");
  return new mod.PaddleOcrService();
};

const SAMPLE_RESULT = {
  image: { width: 100, height: 200 },
  items: [
    {
      poly: [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ] as [number, number][],
      text: "DC26070912345678901234",
      score: 0.95,
    },
  ],
  metrics: {
    detMs: 1,
    recMs: 2,
    totalMs: 3,
    detectedBoxes: 1,
    recognizedCount: 1,
  },
  runtime: {
    requestedBackend: "wasm",
    detProvider: "wasm",
    recProvider: "wasm",
    webgpuAvailable: false,
  },
};

describe("PaddleOcrService", () => {
  beforeEach(() => {
    fakeRunner.predict.mockReset();
    fakeRunner.dispose.mockReset();
    createMock.mockReset();
    createMock.mockResolvedValue(fakeRunner);
  });

  it("recognize 自动初始化并返回归一化 OcrDocument", async () => {
    fakeRunner.predict.mockResolvedValue([SAMPLE_RESULT]);

    const service = await loadService();
    const blob = new Blob(["x"], { type: "image/png" });
    const file = new File([blob], "a.png", { type: "image/png" });

    const doc = await service.recognize(file);

    expect(doc.width).toBe(100);
    expect(doc.height).toBe(200);
    expect(doc.blocks).toHaveLength(1);
    expect(doc.blocks[0].text).toBe("DC26070912345678901234");
    expect(doc.blocks[0].confidence).toBe(0.95);
    expect(doc.blocks[0].polygon).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
    expect(doc.rawText).toBe("DC26070912345678901234");
    expect(doc.durationMs).toBe(3);
  });

  it("多次 recognize 只 create 一次引擎", async () => {
    fakeRunner.predict.mockResolvedValue([SAMPLE_RESULT]);

    const service = await loadService();
    const file = new File([new Blob(["x"])], "a.png", { type: "image/png" });

    await service.recognize(file);
    await service.recognize(file);
    await service.recognize(file);

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(fakeRunner.predict).toHaveBeenCalledTimes(3);
  });

  it("create 失败时抛 OcrError(InitializationFailed)", async () => {
    createMock.mockRejectedValue(new Error("model missing"));
    const service = await loadService();
    const file = new File([new Blob(["x"])], "a.png", { type: "image/png" });

    const { OcrErrorCode } = await import("./types");
    await expect(service.recognize(file)).rejects.toMatchObject({
      name: "OcrError",
      code: OcrErrorCode.InitializationFailed,
    });
  });

  it("predict 失败时抛 OcrError(InferenceFailed)", async () => {
    fakeRunner.predict.mockRejectedValue(new Error("onnx crash"));
    const service = await loadService();
    const file = new File([new Blob(["x"])], "a.png", { type: "image/png" });

    const { OcrErrorCode } = await import("./types");
    await expect(service.recognize(file)).rejects.toMatchObject({
      name: "OcrError",
      code: OcrErrorCode.InferenceFailed,
    });
  });

  it("predict 返回空数组时抛 OcrError(ResultParseFailed)", async () => {
    fakeRunner.predict.mockResolvedValue([]);
    const service = await loadService();
    const file = new File([new Blob(["x"])], "a.png", { type: "image/png" });

    const { OcrErrorCode } = await import("./types");
    await expect(service.recognize(file)).rejects.toMatchObject({
      name: "OcrError",
      code: OcrErrorCode.ResultParseFailed,
    });
  });

  it("dispose 调用底层 dispose 并允许重新初始化", async () => {
    fakeRunner.predict.mockResolvedValue([SAMPLE_RESULT]);
    const service = await loadService();
    const file = new File([new Blob(["x"])], "a.png", { type: "image/png" });

    await service.recognize(file);
    expect(createMock).toHaveBeenCalledTimes(1);

    await service.dispose();
    expect(fakeRunner.dispose).toHaveBeenCalledTimes(1);

    // dispose 后再次 recognize 应触发新一轮 create
    await service.recognize(file);
    expect(createMock).toHaveBeenCalledTimes(2);
  });
});
