// API envelope (TAD g05 §3) + cluster-1 response shapes.

import type { BackendClassicMode, BackendLanguage, BackendTheme } from './constants';

export type ApiSuccess<T> = { success: true; data: T };
export type ApiError = {
  success: false;
  error: { code: string; message: string; detail?: string };
};
export type ApiEnvelope<T> = ApiSuccess<T> | ApiError;

// POST /auth/login (c08 §2)
export interface LoginResponseData {
  token: string;
  expires_in: number;
}

// GET /version (g02 §3)
export interface VersionResponseData {
  app_version: string;
  prd_version: string;
  srs_version: string;
  tad_version: string;
  model_version: string;
  db_tables: number;
}

// GET /health (g02 §3)
export interface HealthResponseData {
  status: 'ok' | 'degraded';
  active_job: string | null;
}

// GET/PUT /settings (SRS f15)
export interface SettingsData {
  buy_threshold: number;
  hold_min_threshold: number;
  default_capital: number;

  source_cafef: boolean;
  source_vnexpress: boolean;
  source_vietstock: boolean;
  source_batdongsan: boolean;
  source_thanhnien: boolean;

  telegram_enabled: boolean;
  telegram_chat_id: string;
  telegram_token: string;
  telegram_top_n: 3 | 5;

  theme: BackendTheme;
  classic_mode: BackendClassicMode;
  language: BackendLanguage;

  settings_version: number;
  updated_at: string;
}
