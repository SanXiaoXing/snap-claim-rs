import { describe, it, expect } from "vitest";
import { validateImageInput, MAX_IMAGE_BYTES } from "./validate";
import { OcrErrorCode } from "./types";

function file(name: string, size: number): File {
  // ponytail: 用空内容构造指定大小的 File，size 由构造参数决定，无需真实字节
  return new File([new Uint8Array(size)], name, { type: "image/png" });
}

describe("validateImageInput", () => {
  it("超过 10MB 的文件被拒绝 (InvalidInput)", () => {
    const tooBig = file("big.png", MAX_IMAGE_BYTES + 1);
    try {
      validateImageInput(tooBig);
      throw new Error("应抛出 OcrError");
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as { code?: string }).code).toBe(OcrErrorCode.InvalidInput);
    }
  });

  it("不支持的扩展名被拒绝", () => {
    const gif = new File([new Uint8Array(1024)], "doc.gif", { type: "image/gif" });
    try {
      validateImageInput(gif);
      throw new Error("应抛出 OcrError");
    } catch (e) {
      expect((e as { code?: string }).code).toBe(OcrErrorCode.InvalidInput);
    }
  });

  it("合法的 png/jpg/jpeg/webp/bmp 且在大小内通过", () => {
    for (const name of ["a.png", "b.JPG", "c.Jpeg", "d.webp", "e.BMP"]) {
      const f = new File([new Uint8Array(1024)], name, { type: "image/png" });
      expect(() => validateImageInput(f)).not.toThrow();
    }
  });
});
