/// 图片识别时，从 OCR 文本里抽取 App 订单列表截图的隐式信息（订单号 + 末行金额）。
/// 用于补强后端规则——订单号前缀即告知发票类型，末行 ¥xxx 即金额。
/// ponytail: 文本中可能没抽出 ¥符（如「￥」、「.00」之间空格），正则尽量宽松。
export type ImageOrderType = "car" | "flight" | "hotel";

export interface ImageHint {
  orderType: ImageOrderType;
  orderId: string;
  amount: number | null;
}

/// DC=用车 DF=机票 DH=酒店（用户约定）。订单号:2 位字母 + 14~22 位数字
const ORDER_TYPE_BY_PREFIX: Record<string, ImageOrderType> = {
  DC: "car",
  DF: "flight",
  HO: "hotel",
};

const ORDER_RE = /\b([A-Z]{2})(\d{14,22})\b/g;
/// 末行 ¥金额：先取文本中所有金额，按"行"定位，取最后一行匹配。
const AMOUNT_RE = /[¥￥]\s*([\d,]+(?:\.\d+)?)/g;

export function extractImageHint(text: string): ImageHint | null {
  ORDER_RE.lastIndex = 0;
  const orderMatch = ORDER_RE.exec(text);
  if (!orderMatch) return null;
  const prefix = orderMatch[1];
  const orderType = ORDER_TYPE_BY_PREFIX[prefix];
  if (!orderType) return null;
  const orderId = `${orderMatch[1]}${orderMatch[2]}`;

  const amount = extractLastLineAmount(text);
  return { orderType, orderId, amount };
}

/// 找文本中最末一行出现的 ¥xxx.xx（OCR 行序大致是上→下，"最后一行"就是订单卡片底部金额）。
function extractLastLineAmount(text: string): number | null {
  // 按换行切，对每行跑一次 AMOUNT_RE，保留最后一次命中
  const lines = text.split(/\r?\n/);
  let lastAmount: number | null = null;
  for (const line of lines) {
    AMOUNT_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = AMOUNT_RE.exec(line)) !== null) {
      const num = Number(m[1].replace(/,/g, ""));
      if (!Number.isNaN(num)) lastAmount = num;
    }
  }
  return lastAmount;
}

/// 长截图多订单切片：按订单号行作分界，把 OCR 文本切成多个段。
/// 每个段对应一张订单卡片（订单号行 → 下一订单号行之前）。
/// 返回的段数 = 订单号出现次数。无订单号 → 空数组（由调用方决定走原路径）。
/// ponytail: 用"订单号所在行"做分界——OCR 行序大致对应卡片上→下顺序，
/// 第 N 个订单号行到第 N+1 个订单号行-1 之间就是第 N 个卡片的全部文本。
export function splitOrderSegments(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const orderLineIdx: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    ORDER_RE.lastIndex = 0;
    if (ORDER_RE.test(lines[i])) {
      orderLineIdx.push(i);
    }
  }
  if (orderLineIdx.length === 0) return [];

  const segs: string[] = [];
  for (let i = 0; i < orderLineIdx.length; i++) {
    const start = orderLineIdx[i];
    const end = i + 1 < orderLineIdx.length ? orderLineIdx[i + 1] : lines.length;
    segs.push(lines.slice(start, end).join("\n"));
  }
  return segs;
}
