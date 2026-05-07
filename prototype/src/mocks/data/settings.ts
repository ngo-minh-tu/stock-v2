// In-memory settings store. Defaults match SRS f15 schema + g03 constants.
// Cluster 6 wires full editing through here.

import type { SettingsData } from '@/lib/types';

let current: SettingsData = {
  buy_threshold: 75,
  hold_min_threshold: 45,
  default_capital: 0,

  source_cafef: true,
  source_vnexpress: true,
  source_vietstock: true,
  source_batdongsan: true,
  source_thanhnien: true,

  telegram_enabled: false,
  telegram_chat_id: '',
  telegram_token: '',
  telegram_top_n: 3,

  theme: 'CLASSIC',
  classic_mode: 'DARK',
  language: 'VIE',

  settings_version: 1,
  updated_at: new Date('2026-05-04T00:00:00Z').toISOString(),
};

export function getSettings(): SettingsData {
  return { ...current };
}

/** Validate a partial patch against SRS f15 §Validation rules. Returns null on pass. */
export function validateSettingsPatch(patch: Record<string, unknown>): string | null {
  // Compose effective values (patch overlaid on current) so validation runs against the
  // post-merge state — single-field updates wouldn't otherwise trigger cross-field checks.
  const next = { ...current, ...(patch as Partial<SettingsData>) };

  if (
    typeof next.buy_threshold === 'number' &&
    typeof next.hold_min_threshold === 'number' &&
    next.buy_threshold <= next.hold_min_threshold
  ) {
    return 'Ngưỡng MUA phải lớn hơn ngưỡng GIỮ.';
  }
  if (typeof next.buy_threshold === 'number' && (next.buy_threshold < 50 || next.buy_threshold > 95)) {
    return 'Ngưỡng MUA phải trong khoảng 50–95.';
  }
  if (
    typeof next.hold_min_threshold === 'number' &&
    (next.hold_min_threshold < 20 || next.hold_min_threshold > 74)
  ) {
    return 'Ngưỡng GIỮ phải trong khoảng 20–74.';
  }
  if (next.telegram_top_n !== 3 && next.telegram_top_n !== 5) {
    return 'Top N của Telegram phải là 3 hoặc 5.';
  }
  if (next.telegram_enabled) {
    if (!next.telegram_chat_id || typeof next.telegram_chat_id !== 'string') {
      return 'Bật Telegram cần điền chat_id.';
    }
    if (!next.telegram_token || typeof next.telegram_token !== 'string') {
      return 'Bật Telegram cần điền bot token.';
    }
  }
  if (!['CLASSIC', 'LIGHT', 'OLED'].includes(next.theme)) {
    return 'Theme không hợp lệ.';
  }
  if (!['DARK', 'LIGHT'].includes(next.classic_mode)) {
    return 'classic_mode không hợp lệ.';
  }
  if (!['VIE', 'ENG'].includes(next.language)) {
    return 'language không hợp lệ.';
  }
  return null;
}

export function patchSettings(patch: Partial<SettingsData>): SettingsData {
  current = {
    ...current,
    ...patch,
    settings_version: current.settings_version + 1,
    updated_at: new Date().toISOString(),
  };
  return { ...current };
}
