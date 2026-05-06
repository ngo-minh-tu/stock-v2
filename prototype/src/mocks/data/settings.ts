// In-memory settings store. Defaults match SRS f15 schema + g03 constants.
// Cluster 6 will move full editing here; cluster 1 only persists theme + language.

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

export function patchSettings(patch: Partial<SettingsData>): SettingsData {
  current = {
    ...current,
    ...patch,
    settings_version: current.settings_version + 1,
    updated_at: new Date().toISOString(),
  };
  return { ...current };
}
