// API envelope (TAD g05 §3) + cluster response shapes.

import type {
  BackendClassicMode,
  BackendLanguage,
  BackendTheme,
  EntrySignal,
  ExcludedReasonCode,
  ExcludedRound,
  Recommendation,
  RunStatus,
  WarningBadge,
} from './constants';

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

// =====================================================================
// Cluster 2: Screening run + results + dashboard
// =====================================================================

// POST /api/run (TAD g01 §2.2) — 202 Accepted
export interface RunStartRequest {
  total_capital: number;
}
export interface RunStartResponse {
  run_id: string;
  status: RunStatus;
}

// GET /api/runs/{run_id}/status (TAD g01 §2.2)
export interface RunStatusResponse {
  run_id: string;
  status: RunStatus;
  progress_percent: number;
  current_step: string;
  message?: string;
  warnings: RunWarning[];
  run_error?: string | null;
}

export interface RunWarning {
  code: 'data_from_cache' | 'telegram_error' | 'partial_news' | 'imputed_features';
  message: string;
}

// One reason for a recommendation, traceable to feature ID per GUARD-02.
export interface ScreeningReason {
  text: string;
  feature_id: string;
  value?: number | string;
}

// One row in /api/runs/{run_id}/results (full per-ticker payload).
export interface ScreeningResult {
  ticker: string;
  name: string;
  exchange: 'HOSE' | 'HNX' | 'UPCOM';
  sector: string;
  current_price: number;          // ngàn đồng (e.g. 32.5 = 32,500 VND)
  market_cap: number;              // tỷ đồng
  ai_score: number;                // 0–100
  recommendation: Recommendation;
  confidence_raw: number;
  confidence_penalty: number;
  confidence: number;              // raw - penalty, capped 0..100
  target_price_3m: number;
  upside_pct: number;
  entry_signal: EntrySignal;
  buy_price?: number;
  stop_loss_price?: number;
  allocation_amount?: number;
  allocation_weight?: number;
  warning_badges: WarningBadge[];
  reasons: ScreeningReason[];
  radar: {
    fundamental: number;
    technical: number;
    macro: number;
    realestate: number;
    sentiment: number;
  };
}

export interface ExcludedStock {
  ticker: string;
  name: string;
  excluded_round: ExcludedRound;
  reason_code: ExcludedReasonCode;
  reason_text: string;
}

// GET /api/runs/{run_id}/results
export interface RunResultsResponse {
  run_id: string;
  results: ScreeningResult[];
  excluded: ExcludedStock[];
  warnings: RunWarning[];
}

// GET /api/runs/{run_id} — summary metadata
export interface RunSummary {
  run_id: string;
  run_at: string;
  status: RunStatus;
  total_input: number;
  scored_count: number;
  buy_count: number;
  hold_count: number;
  sell_count: number;
  total_capital: number;
  data_from_cache: boolean;
}

// GET /api/runs?limit=10
export interface RunsListResponse {
  items: RunSummary[];
  total: number;
  limit: number;
  offset: number;
}

// GET /api/runs/{run_id}/dashboard (TAD c05 §1) — single payload, 6 visuals + KPIs.
export interface DashboardResponse {
  run_id: string;
  run_at: string;
  kpi: {
    scored_count: number;
    buy_count: number;
    hold_count: number;
    sell_count: number;
    avg_buy_score: number;
    top_upside: { ticker: string; upside_pct: number } | null;
    alpha_vs_vnindex_pct: number | null;
  };
  treemap: { ticker: string; name: string; market_cap: number; recommendation: Recommendation; ai_score: number }[];
  pie: { recommendation: Recommendation; count: number }[];
  line: { points: { date: string; vnindex: number; sector: number }[] };
  bar: { ticker: string; ai_score: number; recommendation: Recommendation }[];
  radar: { fundamental: number; technical: number; macro: number; realestate: number; sentiment: number };
}
