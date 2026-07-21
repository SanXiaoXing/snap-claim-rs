import { describe, it, expect } from "vitest";
import { extractImageHint, splitOrderSegments } from "./imageHint";

describe("extractImageHint", () => {
  it("从文本中识别 DC 开头的用车订单号", () => {
    const text = `
订单编号:DC26070912345678901234
北京大兴机场望京网约车出发
2026-07-10 16:45:30
¥150.00
`;
    const hint = extractImageHint(text);
    expect(hint).toEqual({ orderType: "car", orderId: "DC26070912345678901234", amount: 150 });
  });

  it("从文本中识别 DF 开头的机票订单号", () => {
    const text = `订单号 DF26070998765432101234\n上海虹桥-北京首都\n2026-07-09 08:00\n¥10700.00`;
    const hint = extractImageHint(text);
    expect(hint).toEqual({ orderType: "flight", orderId: "DF26070998765432101234", amount: 10700 });
  });

  it("从文本中识别 DH 开头的酒店订单号", () => {
    const text = `订单号 DH26070955556666777788\n上海浦东全季酒店\n入住 2026-07-10 离店 2026-07-12\n¥152.00`;
    const hint = extractImageHint(text);
    expect(hint).toEqual({ orderType: "hotel", orderId: "DH26070955556666777788", amount: 152 });
  });

  it("末行 ¥金额支持千分位逗号和小数", () => {
    const text = `订单号 DF26070911112222333344\n2026-07-09\n¥1,070.00`;
    const hint = extractImageHint(text);
    expect(hint?.amount).toBe(1070);
  });

  it("无订单号时返回 null", () => {
    const text = `这是一段普通文本\n没有订单号\n¥100.00`;
    expect(extractImageHint(text)).toBeNull();
  });

  it("订单号前缀未知（如 DX）时返回 null", () => {
    const text = `订单号 DX26070912345678901234\n¥100.00`;
    expect(extractImageHint(text)).toBeNull();
  });

  it("未找到 ¥金额时仍返回订单号 + 类型，amount 为 null", () => {
    const text = `订单号 DC26070912345678901234\n某标题\n无金额`;
    const hint = extractImageHint(text);
    expect(hint).toEqual({ orderType: "car", orderId: "DC26070912345678901234", amount: null });
  });
});

describe("splitOrderSegments", () => {
  it("无订单号时返回空数组（整段文本由调用方决定是否走原路径）", () => {
    expect(splitOrderSegments("普通文本\n没有订单号\n¥100.00")).toEqual([]);
  });

  it("单个订单号 → 单段切片（覆盖全文）", () => {
    const text = "订单号 DC26070912345678901234\n标题\n¥150.00";
    const segs = splitOrderSegments(text);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toContain("DC26070912345678901234");
    expect(segs[0]).toContain("¥150.00");
  });

  it("多个订单号 → 多段切片，每段以订单号行开头", () => {
    const text = [
      "订单号 DC26070912345678901234",
      "用车标题",
      "¥150.00",
      "订单号 DF26070998765432101234",
      "机票标题",
      "¥10700.00",
      "订单号 DH26070955556666777788",
      "酒店标题",
      "¥152.00",
    ].join("\n");
    const segs = splitOrderSegments(text);
    expect(segs).toHaveLength(3);
    expect(segs[0]).toContain("DC26070912345678901234");
    expect(segs[0]).toContain("¥150.00");
    expect(segs[0]).not.toContain("DF26070998765432101234");
    expect(segs[1]).toContain("DF26070998765432101234");
    expect(segs[1]).toContain("¥10700.00");
    expect(segs[1]).not.toContain("DH26070955556666777788");
    expect(segs[2]).toContain("DH26070955556666777788");
    expect(segs[2]).toContain("¥152.00");
  });

  it("切片可单独喂 extractImageHint 得到各自的 hint", () => {
    const text = [
      "订单号 DC26070912345678901234",
      "¥150.00",
      "订单号 DH26070955556666777788",
      "¥152.00",
    ].join("\n");
    const segs = splitOrderSegments(text);
    expect(extractImageHint(segs[0])).toEqual({
      orderType: "car",
      orderId: "DC26070912345678901234",
      amount: 150,
    });
    expect(extractImageHint(segs[1])).toEqual({
      orderType: "hotel",
      orderId: "DH26070955556666777788",
      amount: 152,
    });
  });
});
