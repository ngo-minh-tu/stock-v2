// Reason codes used in EntryResult.reason_code (SRS f03 / TAD c03).
// Strict lookup table — GUARD-02 forbids LLM-generated free text. The Stock Detail UI
// splits a code like "VALUATION_ATTRACTIVE+BULLISH_TREND" on '+' and looks each token up here.

import type { EntrySignal } from '@/lib/constants';

export const REASON_CODES = [
  'VALUATION_ATTRACTIVE',
  'BULLISH_TREND',
  'NAV_DISCOUNT',
  'STRONG_FUNDAMENTAL',
  'MACD_BULLISH_CROSS',
  'NEAR_RESISTANCE',
  'NEAR_SUPPORT',
  'OVERBOUGHT',
  'OVERSOLD',
  'WEAK_TREND',
  'AWAIT_BREAKOUT',
  'AWAIT_PULLBACK',
  'AWAIT_CONFIRMATION',
  'NEGATIVE_RECOMMENDATION',
  'INSUFFICIENT_INDICATORS',
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

// Vietnamese + English labels are kept right next to the enum so callers don't need to
// look them up in i18n files. Keeps the mock layer self-contained.
export const REASON_LABEL: Record<ReasonCode, { vi: string; en: string }> = {
  VALUATION_ATTRACTIVE: { vi: 'Định giá hấp dẫn', en: 'Attractive valuation' },
  BULLISH_TREND: { vi: 'Xu hướng tăng', en: 'Bullish trend' },
  NAV_DISCOUNT: { vi: 'Chiết khấu NAV', en: 'NAV discount' },
  STRONG_FUNDAMENTAL: { vi: 'Cơ bản mạnh', en: 'Strong fundamentals' },
  MACD_BULLISH_CROSS: { vi: 'MACD cắt lên', en: 'MACD bullish cross' },
  NEAR_RESISTANCE: { vi: 'Gần kháng cự', en: 'Near resistance' },
  NEAR_SUPPORT: { vi: 'Gần hỗ trợ', en: 'Near support' },
  OVERBOUGHT: { vi: 'Quá mua', en: 'Overbought' },
  OVERSOLD: { vi: 'Quá bán', en: 'Oversold' },
  WEAK_TREND: { vi: 'Xu hướng yếu', en: 'Weak trend' },
  AWAIT_BREAKOUT: { vi: 'Chờ vượt kháng cự', en: 'Awaiting breakout' },
  AWAIT_PULLBACK: { vi: 'Chờ điều chỉnh', en: 'Awaiting pullback' },
  AWAIT_CONFIRMATION: { vi: 'Chờ xác nhận', en: 'Awaiting confirmation' },
  NEGATIVE_RECOMMENDATION: { vi: 'Khuyến nghị GIỮ/BÁN', en: 'Hold/Sell recommendation' },
  INSUFFICIENT_INDICATORS: { vi: 'Thiếu chỉ báo kỹ thuật', en: 'Insufficient indicators' },
};

// Default reason composition per entry signal (used when the screening result didn't
// carry one explicitly — the Stock Detail fixture always provides this).
export const DEFAULT_REASON_BY_SIGNAL: Record<EntrySignal, ReasonCode[]> = {
  BUY_STRONG: ['VALUATION_ATTRACTIVE', 'BULLISH_TREND', 'NAV_DISCOUNT'],
  BUY_NOW: ['VALUATION_ATTRACTIVE', 'BULLISH_TREND'],
  WAIT_FOR_BREAKOUT: ['NEAR_RESISTANCE', 'AWAIT_BREAKOUT'],
  WAIT_FOR_PULLBACK: ['OVERBOUGHT', 'AWAIT_PULLBACK'],
  WAIT_FOR_CONFIRMATION: ['WEAK_TREND', 'AWAIT_CONFIRMATION'],
  NO_ENTRY: ['NEGATIVE_RECOMMENDATION'],
  INSUFFICIENT_DATA: ['INSUFFICIENT_INDICATORS'],
};

export function parseReasonCode(code: string): ReasonCode[] {
  return code
    .split('+')
    .map((s) => s.trim())
    .filter((s): s is ReasonCode => (REASON_CODES as readonly string[]).includes(s));
}

export function reasonLabel(code: ReasonCode, locale: 'vi' | 'en'): string {
  return REASON_LABEL[code][locale];
}
