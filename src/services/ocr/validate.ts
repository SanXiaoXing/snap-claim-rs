import { OcrError, OcrErrorCode } from "./types";

/// 图片输入上限（docs/LOCAL_OCR_SPEC.md §13.2：10 MB）
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/// 支持的图片格式（§13.1）
const SUPPORTED_EXTS = new Set(["png", "jpg", "jpeg", "webp", "bmp"]);

/// 校验图片输入：大小 ≤ 10MB、扩展名受支持。不通过抛 OcrError(InvalidInput)。
export function validateImageInput(file: File): void {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new OcrError(OcrErrorCode.InvalidInput, `图片过大：${file.size} 字节，上限 ${MAX_IMAGE_BYTES}`);
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!SUPPORTED_EXTS.has(ext)) {
    throw new OcrError(OcrErrorCode.InvalidInput, `不支持的图片格式：.${ext || "?"}`);
  }
}
