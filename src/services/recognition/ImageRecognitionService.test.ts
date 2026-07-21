import { describe, it, expect, vi } from "vitest";
import { ImageRecognitionService } from "./ImageRecognitionService";
import { OcrErrorCode, OcrError, type OcrDocument, type OcrService } from "../ocr/types";
import type { InvoiceRecord } from "../../types";

function fakeOcr(doc: OcrDocument): OcrService {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    recognize: vi.fn().mockResolvedValue(doc),
    dispose: vi.fn().mockResolvedValue(undefined),
  };
}

const sampleDoc: OcrDocument = {
  width: 800,
  height: 600,
  blocks: [],
  rawText: "价税合计：150.00元",
  durationMs: 100,
};

const sampleRecord: InvoiceRecord = {
  type: "invoice",
  amount: 150,
  qrAmount: false,
  filename: "inv.png",
  fullPath: "inv.png",
  pageNumber: 1,
};

describe("ImageRecognitionService", () => {
  it("happy path: 校验→OCR→解析，返回 InvoiceRecord[]", async () => {
    const ocr = fakeOcr(sampleDoc);
    const parse = vi.fn().mockResolvedValue(sampleRecord);
    const svc = new ImageRecognitionService(ocr, parse);

    const file = new File([new Uint8Array(1024)], "inv.png", { type: "image/png" });
    const records = await svc.recognizeAll(file, "/path/to/inv.png");

    expect(ocr.recognize).toHaveBeenCalledWith(file);
    // 解析拿到 OCR 的 rawText + 文件名；图片视为第 1 页；文本无订单号 → imageHint=null
    expect(parse).toHaveBeenCalledWith("价税合计：150.00元", "inv.png", "/path/to/inv.png", 1, null);
    expect(records).toEqual([sampleRecord]);
  });

  it("非法输入直接抛错，不调用 OCR 与解析", async () => {
    const ocr = fakeOcr(sampleDoc);
    const parse = vi.fn();
    const svc = new ImageRecognitionService(ocr, parse);

    const tooBig = new File([new Uint8Array(11 * 1024 * 1024)], "big.png", { type: "image/png" });
    await expect(svc.recognizeAll(tooBig, "/path/to/big.png")).rejects.toMatchObject({ code: OcrErrorCode.InvalidInput });
    expect(ocr.recognize).not.toHaveBeenCalled();
    expect(parse).not.toHaveBeenCalled();
  });

  it("OCR 失败时错误向上传播", async () => {
    const ocr: OcrService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      recognize: vi.fn().mockRejectedValue(new OcrError(OcrErrorCode.InferenceFailed, "boom")),
      dispose: vi.fn().mockResolvedValue(undefined),
    };
    const parse = vi.fn();
    const svc = new ImageRecognitionService(ocr, parse);

    const file = new File([new Uint8Array(1024)], "inv.png", { type: "image/png" });
    await expect(svc.recognizeAll(file, "/path/to/inv.png")).rejects.toMatchObject({ code: OcrErrorCode.InferenceFailed });
    expect(parse).not.toHaveBeenCalled();
  });

  it("OCR 文本含订单号 DC 时，parse 收到 imageHint(orderType=car)", async () => {
    const docWithOrder: OcrDocument = {
      ...sampleDoc,
      rawText: "订单号 DC26070912345678901234\n北京大兴机场望京网约车\n¥150.00",
    };
    const ocr = fakeOcr(docWithOrder);
    const parse = vi.fn().mockResolvedValue({ ...sampleRecord, type: "car", amount: 150 });
    const svc = new ImageRecognitionService(ocr, parse);

    const file = new File([new Uint8Array(1024)], "car.png", { type: "image/png" });
    await svc.recognizeAll(file, "/path/to/car.png");

    expect(parse).toHaveBeenCalledWith(
      docWithOrder.rawText,
      "car.png",
      "/path/to/car.png",
      1,
      { orderType: "car", orderId: "DC26070912345678901234", amount: 150 },
    );
  });

  it("长截图含多个订单 → 切片后多次 parse → 返回多份 InvoiceRecord", async () => {
    const multiOrderDoc: OcrDocument = {
      ...sampleDoc,
      rawText: [
        "订单号 DC26070912345678901234",
        "用车标题",
        "¥150.00",
        "订单号 DH26070955556666777788",
        "酒店标题",
        "¥152.00",
      ].join("\n"),
    };
    const ocr = fakeOcr(multiOrderDoc);
    const carRecord: InvoiceRecord = { ...sampleRecord, type: "car", amount: 150 };
    const hotelRecord: InvoiceRecord = { ...sampleRecord, type: "hotel", amount: 152 };
    // parse 第 1 次返回 car，第 2 次返回 hotel
    const parse = vi
      .fn()
      .mockResolvedValueOnce(carRecord)
      .mockResolvedValueOnce(hotelRecord);
    const svc = new ImageRecognitionService(ocr, parse);

    const file = new File([new Uint8Array(1024)], "multi.png", { type: "image/png" });
    const records = await svc.recognizeAll(file, "/path/to/multi.png");

    expect(parse).toHaveBeenCalledTimes(2);
    expect(parse).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("DC26070912345678901234"),
      "multi.png",
      "/path/to/multi.png",
      1,
      { orderType: "car", orderId: "DC26070912345678901234", amount: 150 },
    );
    expect(parse).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("DH26070955556666777788"),
      "multi.png",
      "/path/to/multi.png",
      1,
      { orderType: "hotel", orderId: "DH26070955556666777788", amount: 152 },
    );
    expect(records).toEqual([carRecord, hotelRecord]);
  });
});
