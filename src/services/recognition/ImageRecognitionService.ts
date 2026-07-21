import type { InvoiceRecord } from "../../types";
import type { OcrService } from "../ocr/types";
import { extractImageHint, splitOrderSegments, type ImageHint } from "../ocr/imageHint";
import { validateImageInput } from "../ocr/validate";

/// 把 OCR 文本交给业务解析层（实际实现调用 Rust recognize_from_text）。
/// imageHint：前端从文本预抽的订单号/末行金额，用于补强类型判断与金额提取。
export type ParseFromText = (
  text: string,
  filename: string,
  fullPath: string,
  pageNumber: number,
  imageHint: ImageHint | null,
) => Promise<InvoiceRecord>;

/// 图片识别编排：校验 → OCR → 逐段业务解析（复用 Rust recognize_from_text）。
/// 图片不做二维码识别（docs/LOCAL_OCR_SPEC.md §7.2），一张图视为第 1 页一份单据。
/// 长截图含多个订单号时按订单号切片，每段对应一份 InvoiceRecord。
/// 前端主导流程：PaddleOCR 出文本后，逐段调 Rust 解析，每段完成通过 onRecord 即时回调。
export class ImageRecognitionService {
  constructor(
    private readonly ocr: OcrService,
    private readonly parse: ParseFromText,
  ) {}

  /// 识别图片，每识别出一个订单段就通过 onRecord 回调通知前端即时显示。
  /// 仍返回完整记录数组，便于调用方汇总。
  async recognizeAll(file: File, fullPath: string, onRecord?: (record: InvoiceRecord) => void): Promise<InvoiceRecord[]> {
    validateImageInput(file);

    const doc = await this.ocr.recognize(file);

    // 长截图多订单切片：按订单号行分界，每段对应一张订单卡片
    const segments = splitOrderSegments(doc.rawText);
    if (segments.length === 0) {
      const record = await this.parse(doc.rawText, file.name, fullPath, 1, null);
      onRecord?.(record);
      return [record];
    }

    const records: InvoiceRecord[] = [];
    for (const seg of segments) {
      const imageHint = extractImageHint(seg);
      if (imageHint) {
        console.log(
          `[image-ocr] 订单号=${imageHint.orderId} 类型=${imageHint.orderType} 金额=${imageHint.amount ?? "null"}`,
        );
      }
      const record = await this.parse(seg, file.name, fullPath, 1, imageHint);
      onRecord?.(record);
      records.push(record);
    }
    return records;
  }
}
