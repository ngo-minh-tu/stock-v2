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

// =====================================================================
// Cluster 3: Stock Detail (TAD g02 §4) + price history
// =====================================================================

// Static info — also used by /api/stocks/{ticker}.
export interface StockStaticInfo {
  ticker: string;
  name: string;
  exchange: 'HOSE' | 'HNX' | 'UPCOM';
  sector: string;
  current_price: number; // ngàn đồng (32.5 = 32,500 VND), matches ScreeningResult convention
  reference_price?: number; // for %change display
}

// Full per-run stock analysis. Mirrors TAD g02 §4 example (KDH-like).
export interface StockDetailResponse {
  ticker: string;
  name: string;
  run_id: string;
  static: StockStaticInfo;
  scoring: {
    ai_score: number;
    recommendation: Recommendation;
    confidence_raw: number;
    confidence_penalty: number;
    confidence: number;
    target_price_3m: number;
    upside_pct: number;
  };
  entry: {
    signal: EntrySignal;
    reason_code: string; // "VALUATION_ATTRACTIVE+BULLISH_TREND"
    support_zone: number;
    resistance_zone: number;
    raw_indicators_used: string[];
  };
  // Raw indicators (SRS f03) — used for the entry visualization, NOT scoring features.
  raw_indicators: {
    ma20: number;
    ma50: number;
    ma200: number;
    ema12: number;
    ema26: number;
    rsi: number;
    macd_histogram: number;
    macd_signal_cross: boolean;
    bollinger_upper: number;
    bollinger_lower: number;
  };
  risk: {
    stop_loss_price: number;
    allocation_amount: number;
    allocation_weight: number;
    warning_badges: WarningBadge[];
    has_buy_price: boolean;
  };
  reasons: ScreeningReason[];
  features: Record<string, number>; // 32-38 of the 38-feature dict (some imputed)
  imputed_features: string[]; // feature IDs marked as imputed
  feature_availability: number; // 32..38
  radar: {
    fundamental: number;
    technical: number;
    macro: number;
    realestate: number;
    sentiment: number;
  };
  // Industry average for radar overlay (faded). Sourced from the run dashboard.
  radar_industry_avg?: {
    fundamental: number;
    technical: number;
    macro: number;
    realestate: number;
    sentiment: number;
  };
}

// One OHLCV bar (TAD g02 §1 — /stocks/{ticker}/prices).
export interface OhlcvBar {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockPricesResponse {
  ticker: string;
  period: '1M' | '3M' | '6M' | '1Y';
  bars: OhlcvBar[];
}

// =====================================================================
// Cluster 4: Price Board (/api/stocks list) + News & Sentiment
// =====================================================================

// One row of the price board — combines static info with the latest pricing snapshot.
// `current_price` keeps the cluster 1-3 convention (ngàn đồng).
export interface LatestPrice {
  reference: number; // TC — phiên trước
  ceiling: number;   // Trần
  floor: number;     // Sàn
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;    // share count (raw; format K/M in UI)
}

export interface StockListItem extends StockStaticInfo {
  latest_price: LatestPrice;
  newly_listed: boolean;
}

// GET /api/stocks?limit=100&offset=0 — paginated envelope per g02 §2.
export interface StocksListResponse {
  items: StockListItem[];
  total: number;
  limit: number;
  offset: number;
}

// SRS f10 + GUARD-08 — see constants.ts for enums.
export type NewsSource = 'CAFEF' | 'VNEXPRESS' | 'VIETSTOCK' | 'BATDONGSAN' | 'THANHNIEN';
export type SentimentLabel = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export interface NewsArticle {
  article_id: string;
  source: NewsSource;
  title: string;
  url: string;
  published_at: string;             // ISO8601
  related_tickers: string[];        // 0-3 tickers from STOCK_FIXTURE
  content_snippet: string;          // ~150 chars
  sentiment_label: SentimentLabel;
  sentiment_score: number;          // -1..+1, 2 decimals
  sentiment_reason: string;         // citation or "unavailable" (GUARD-08)
}

// GET /api/news — paginated. `source_errors` exposes GUARD-08 fallback.
export interface NewsListResponse {
  items: NewsArticle[];
  total: number;
  limit: number;
  offset: number;
  source_errors: NewsSource[];      // sources that failed this request (banner trigger)
}

// GET /api/news/sentiment/{ticker} — 30-day rollup.
export interface SentimentSummaryResponse {
  ticker: string;
  window_days: number;              // typically 30 — surfaced so UI can label correctly
  count: number;                    // 0 → label=NEUTRAL, score=0 (GUARD-08)
  label: SentimentLabel;
  score: number;                    // avg across articles, -1..+1
  breakdown: { label: SentimentLabel; count: number }[];
  source_breakdown: { source: NewsSource; count: number }[];
}

// Which runs scored this ticker — populated by /api/stocks/{ticker}/runs (cluster 3 helper).
export interface TickerRunSummary {
  run_id: string;
  run_at: string;
  ai_score: number;
  recommendation: Recommendation;
}
export interface TickerRunsResponse {
  ticker: string;
  items: TickerRunSummary[];
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
