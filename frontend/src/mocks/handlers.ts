// MSW handlers — cluster 1 (auth/version/health/settings) + cluster 2 (run lifecycle).
// Response envelope follows TAD g05 §3.

import { http, HttpResponse } from 'msw';

import {
  MOCK_JWT_PREFIX,
  NEWS_SOURCES,
  SENTIMENT_LABELS,
  type NewsSourceKey,
  type SentimentLabelKey,
} from '@/lib/constants';
import type {
  ApiSuccess,
  ApiError,
  BacktestMetrics,
  CandleInterval,
  CandleLookback,
  BacktestResultsResponse,
  BacktestStartRequest,
  BacktestStartResponse,
  BacktestStatusResponse,
  CompareResponse,
  DashboardResponse,
  HealthResponseData,
  LoginResponseData,
  NewsListResponse,
  PasswordChangeRequest,
  PasswordChangeResponse,
  PortfolioCreateRequest,
  PortfolioHolding,
  PortfolioListResponse,
  PortfolioUpdateRequest,
  RunResultsResponse,
  RunStartRequest,
  RunStartResponse,
  RunStatusResponse,
  RunSummary,
  RunsListResponse,
  SentimentSummaryResponse,
  ShareCreateRequest,
  ShareCreateResponse,
  ShareListResponse,
  SharedViewResponse,
  StockDetailResponse,
  StockPricesResponse,
  StocksListResponse,
  StockStaticInfo,
  TelegramTestResponse,
  TickerRunsResponse,
} from '@/lib/types';

import { backtestStore } from './data/backtest-store';
import { computeCompare } from './data/compare-compute';
import { filterArticles, FIXTURE_NOW_MS, NEWS_CORPUS } from './data/news-fixture';
import { buildPdfHtml } from './data/pdf-template';
import { portfolioStore } from './data/portfolio-store';
import { buildPriceBoardItems } from './data/price-board-fixture';
import { getPrices } from './data/prices-fixture';
import { getSettings, patchSettings, validateSettingsPatch } from './data/settings';
import { runsStore, type RunOutcomeMode } from './data/runs-store';
import { shareStore } from './data/share-store';
import { buildStockDetail } from './data/stock-detail-compute';
import { STOCK_FIXTURE } from './data/stocks-fixture';
import { versionPayload } from './data/version';

function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

function err(code: string, message: string, detail?: string): ApiError {
  return { success: false, error: { code, message, ...(detail ? { detail } : {}) } };
}

// Cluster 5 portfolio validation (SRS f11 ACs 11-02..11-04 + buy_date sanity).
function validateHolding(input: Partial<PortfolioCreateRequest>): string | null {
  if (!input.ticker || typeof input.ticker !== 'string') return 'Thiếu mã (ticker).';
  const upper = input.ticker.toUpperCase();
  if (!STOCK_FIXTURE.some((s) => s.ticker === upper)) {
    return `Mã ${upper} không có trong whitelist.`;
  }
  if (typeof input.quantity !== 'number' || !Number.isFinite(input.quantity) || input.quantity <= 0) {
    return 'Số lượng phải là số dương.';
  }
  if (!Number.isInteger(input.quantity)) {
    return 'Số lượng phải là số nguyên.';
  }
  if (typeof input.buy_price !== 'number' || !Number.isFinite(input.buy_price) || input.buy_price <= 0) {
    return 'Giá mua phải là số dương.';
  }
  if (typeof input.buy_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.buy_date)) {
    return 'Ngày mua phải có dạng YYYY-MM-DD.';
  }
  // Anchor "today" to the fixture (2026-05-07) — see news-fixture / portfolio-store rationale.
  const today = '2026-05-07';
  if (input.buy_date > today) return 'Ngày mua không được sau hôm nay.';
  return null;
}

function validateBacktest(input: Partial<BacktestStartRequest>): string | null {
  if (typeof input.period_from !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.period_from)) {
    return 'period_from phải có dạng YYYY-MM-DD.';
  }
  if (typeof input.period_to !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.period_to)) {
    return 'period_to phải có dạng YYYY-MM-DD.';
  }
  if (input.period_from >= input.period_to) {
    return 'period_from phải trước period_to.';
  }
  return null;
}

export const handlers = [
  // ---------- Cluster 1 ----------
  http.post('/api/auth/login', async () => {
    const data: LoginResponseData = {
      token: `${MOCK_JWT_PREFIX}${Date.now()}`,
      expires_in: 86400,
    };
    return HttpResponse.json(ok(data));
  }),

  http.put('/api/auth/password', async ({ request }) => {
    let body: Partial<PasswordChangeRequest>;
    try {
      body = (await request.json()) as Partial<PasswordChangeRequest>;
    } catch {
      return HttpResponse.json(err('VALIDATION_ERROR', 'Body JSON không hợp lệ.'), { status: 400 });
    }
    if (!body.current || typeof body.current !== 'string') {
      return HttpResponse.json(err('VALIDATION_ERROR', 'Thiếu mật khẩu hiện tại.'), { status: 400 });
    }
    if (!body.new_password || typeof body.new_password !== 'string' || body.new_password.length < 8) {
      return HttpResponse.json(
        err('VALIDATION_ERROR', 'Mật khẩu mới phải có ít nhất 8 ký tự.'),
        { status: 400 },
      );
    }
    // Single-user MVP: any current pwd passes. Issue a fresh token to mimic re-login.
    const data: PasswordChangeResponse = {
      token: `${MOCK_JWT_PREFIX}${Date.now()}`,
    };
    return HttpResponse.json(ok(data));
  }),

  http.get('/api/version', () => HttpResponse.json(ok(versionPayload))),

  http.get('/api/health', () => {
    const data: HealthResponseData = {
      status: 'ok',
      active_job: runsStore.activeJob() ? 'screening_run' : null,
    };
    return HttpResponse.json(ok(data));
  }),

  http.get('/api/settings', () => HttpResponse.json(ok(getSettings()))),

  http.put('/api/settings', async ({ request }) => {
    let patch: Record<string, unknown> = {};
    try {
      patch = (await request.json()) as Record<string, unknown>;
    } catch {
      return HttpResponse.json(err('VALIDATION_ERROR', 'Invalid JSON body'), { status: 400 });
    }
    const error = validateSettingsPatch(patch);
    if (error) {
      return HttpResponse.json(err('VALIDATION_ERROR', error), { status: 400 });
    }
    return HttpResponse.json(ok(patchSettings(patch)));
  }),

  // ---------- Cluster 2: run lifecycle ----------

  // POST /api/run — 202 Accepted | 409 CONFLICT
  http.post('/api/run', async ({ request }) => {
    const url = new URL(request.url);
    const outcomeParam = url.searchParams.get('outcome') as RunOutcomeMode | 'conflict' | null;
    let body: Partial<RunStartRequest> = {};
    try {
      body = (await request.json()) as Partial<RunStartRequest>;
    } catch {
      // Empty body permitted — defaults to capital=0 (skip allocation)
    }

    if (outcomeParam === 'conflict') {
      return HttpResponse.json(
        err('JOB_CONFLICT', 'Đang có tác vụ chạy: screening_run. Vui lòng đợi hoàn thành.'),
        { status: 409 },
      );
    }

    if (runsStore.activeJob()) {
      return HttpResponse.json(
        err('JOB_CONFLICT', `Đang có tác vụ chạy: ${runsStore.activeJob()}. Vui lòng đợi hoàn thành.`),
        { status: 409 },
      );
    }

    const total_capital = typeof body.total_capital === 'number' ? body.total_capital : 0;
    const outcome: RunOutcomeMode =
      outcomeParam === 'failed' || outcomeParam === 'warnings' ? outcomeParam : 'success';

    const record = runsStore.start({ total_capital, outcome });
    const data: RunStartResponse = { run_id: record.run_id, status: record.status };
    return HttpResponse.json(ok(data), { status: 202 });
  }),

  // GET /api/runs?limit=10&offset=0
  http.get('/api/runs', ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 10);
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const { items, total } = runsStore.list(limit, offset);
    const data: RunsListResponse = { items, total, limit, offset };
    return HttpResponse.json(ok(data));
  }),

  // GET /api/runs/:run_id/status — polling endpoint
  http.get('/api/runs/:run_id/status', ({ params }) => {
    const r = runsStore.get(params.run_id as string);
    if (!r) {
      return HttpResponse.json(err('NOT_FOUND', 'Run không tồn tại'), { status: 404 });
    }
    const data: RunStatusResponse = {
      run_id: r.run_id,
      status: r.status,
      progress_percent: r.progress_percent,
      current_step: r.current_step,
      warnings: r.warnings,
      run_error: r.run_error,
    };
    return HttpResponse.json(ok(data));
  }),

  // GET /api/runs/:run_id/results
  http.get('/api/runs/:run_id/results', ({ params }) => {
    const r = runsStore.get(params.run_id as string);
    if (!r) {
      return HttpResponse.json(err('NOT_FOUND', 'Run không tồn tại'), { status: 404 });
    }
    if (!r.computed) {
      return HttpResponse.json(err('NOT_READY', 'Run chưa hoàn thành'), { status: 409 });
    }
    // Phase 9 align with backend Phase 6 shape: {results, total} only — excluded served separately.
    const data: RunResultsResponse = {
      results: r.computed.results,
      total: r.computed.results.length,
    };
    return HttpResponse.json(ok(data));
  }),

  // GET /api/runs/:run_id/dashboard
  http.get('/api/runs/:run_id/dashboard', ({ params }) => {
    const data = runsStore.dashboard(params.run_id as string);
    if (!data) {
      return HttpResponse.json(err('NOT_FOUND', 'Run không tồn tại hoặc chưa hoàn thành'), {
        status: 404,
      });
    }
    return HttpResponse.json(ok<DashboardResponse>(data));
  }),

  // GET /api/runs/:run_id — summary
  http.get('/api/runs/:run_id', ({ params }) => {
    const summary = runsStore.summary(params.run_id as string);
    if (!summary) {
      return HttpResponse.json(err('NOT_FOUND', 'Run không tồn tại'), { status: 404 });
    }
    return HttpResponse.json(ok<RunSummary>(summary));
  }),

  // ---------- Cluster 3: Stock Detail ----------

  // GET /api/runs/:run_id/stocks/:ticker — full per-run analysis (TAD g02 §4).
  http.get('/api/runs/:run_id/stocks/:ticker', ({ params }) => {
    const run_id = params.run_id as string;
    const ticker = (params.ticker as string).toUpperCase();
    const r = runsStore.get(run_id);
    if (!r) {
      return HttpResponse.json(err('NOT_FOUND', 'Run không tồn tại'), { status: 404 });
    }
    if (!r.computed) {
      return HttpResponse.json(err('NOT_READY', 'Run chưa hoàn thành'), { status: 409 });
    }
    const result = r.computed.results.find((x) => x.ticker === ticker);
    if (!result) {
      return HttpResponse.json(
        err('NOT_FOUND', `Mã ${ticker} không có trong run này`),
        { status: 404 },
      );
    }
    // Pull industry-average radar straight from the run dashboard so the overlay matches.
    // Hash the run_id contents (not just length) so different runs of same ticker yield
    // different feature values — otherwise the run-selector switch is cosmetic.
    let runHash = 0;
    for (let i = 0; i < run_id.length; i += 1) {
      runHash = ((runHash << 5) - runHash + run_id.charCodeAt(i)) | 0;
    }
    const detail = buildStockDetail({
      result,
      run_id,
      master_seed: Math.abs(runHash) + result.ticker.charCodeAt(0) * 13,
      industry_avg: r.computed.dashboard.radar,
    });
    return HttpResponse.json(ok<StockDetailResponse>(detail));
  }),

  // GET /api/stocks/:ticker — static info (no run).
  http.get('/api/stocks/:ticker', ({ params }) => {
    const ticker = (params.ticker as string).toUpperCase();
    const seed = STOCK_FIXTURE.find((s) => s.ticker === ticker);
    if (!seed) {
      return HttpResponse.json(err('NOT_FOUND', `Mã ${ticker} không tồn tại`), { status: 404 });
    }
    // Pull current_price from the latest computed run if available, else synthesize one.
    const latest = runsStore.latest();
    const fromRun = latest?.computed?.results.find((r) => r.ticker === ticker);
    const data: StockStaticInfo = {
      ticker: seed.ticker,
      name: seed.name,
      exchange: seed.exchange,
      sector: seed.sector,
      current_price: fromRun?.current_price ?? Number((20 + (seed.seed % 50)).toFixed(2)),
    };
    return HttpResponse.json(ok(data));
  }),

  // GET /api/stocks/:ticker/prices?interval=D&lookback=6T — synthetic OHLCV history.
  // interval ∈ {D, W, M}; lookback ∈ {1T, 3T, 6T, 1N, 3N, YTD, All}. Defaults: D + 6T.
  http.get('/api/stocks/:ticker/prices', ({ request, params }) => {
    const url = new URL(request.url);
    const ticker = (params.ticker as string).toUpperCase();
    const intervalRaw = url.searchParams.get('interval') ?? 'D';
    const lookbackRaw = url.searchParams.get('lookback') ?? '6T';
    const interval = (['D', 'W', 'M'].includes(intervalRaw)
      ? intervalRaw
      : 'D') as CandleInterval;
    const lookback = (['1T', '3T', '6T', '1N', '3N', 'YTD', 'All'].includes(lookbackRaw)
      ? lookbackRaw
      : '6T') as CandleLookback;

    // Anchor current_price from latest run when available so the chart's right edge
    // matches the header's displayed price.
    const latest = runsStore.latest();
    const fromRun = latest?.computed?.results.find((r) => r.ticker === ticker);
    const seed = STOCK_FIXTURE.find((s) => s.ticker === ticker);
    if (!seed) {
      return HttpResponse.json(err('NOT_FOUND', `Mã ${ticker} không tồn tại`), { status: 404 });
    }
    const currentPrice = fromRun?.current_price ?? 20 + (seed.seed % 50);
    const data = getPrices({ ticker, interval, lookback, currentPrice });
    if (!data) {
      return HttpResponse.json(err('NOT_FOUND', `Mã ${ticker} không tồn tại`), { status: 404 });
    }
    return HttpResponse.json(ok<StockPricesResponse>(data));
  }),

  // GET /api/stocks/:ticker/runs — runs that scored this ticker (for the header run-selector).
  http.get('/api/stocks/:ticker/runs', ({ params }) => {
    const ticker = (params.ticker as string).toUpperCase();
    // Cap at 10 most-recent so the dropdown stays small.
    const all = runsStore.list(50, 0).items;
    const items = all
      .map((s) => {
        const r = runsStore.get(s.run_id);
        const hit = r?.computed?.results.find((x) => x.ticker === ticker);
        if (!hit) return null;
        return {
          run_id: s.run_id,
          run_at: s.run_at,
          ai_score: hit.ai_score,
          recommendation: hit.recommendation,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .slice(0, 10);
    const data: TickerRunsResponse = { ticker, items };
    return HttpResponse.json(ok(data));
  }),

  // ---------- Cluster 4: Price Board ----------

  // GET /api/stocks?limit=100&offset=0 — paginated whitelist with latest prices.
  http.get('/api/stocks', ({ request }) => {
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') ?? 100)));
    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0));
    const all = buildPriceBoardItems().filter((row) => !row.ticker.startsWith('MOCK'));
    const items = all.slice(offset, offset + limit);
    const data: StocksListResponse = { items, total: all.length, limit, offset };
    return HttpResponse.json(ok(data));
  }),

  // ---------- Cluster 4: News & Sentiment ----------

  // GET /api/news — paginated, multi-source / multi-sentiment / ticker / date filters.
  // Mock failure: ?mock_news_failure=cafef → drop CAFEF rows + report it in `source_errors`.
  http.get('/api/news', ({ request }) => {
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') ?? 20)));
    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0));

    const sourceParams = url.searchParams.getAll('source');
    const sentimentParams = url.searchParams.getAll('sentiment');
    const ticker = url.searchParams.get('ticker') ?? undefined;
    const fromIso = url.searchParams.get('from') ?? undefined;
    const toIso = url.searchParams.get('to') ?? undefined;
    const failureParam = (url.searchParams.get('mock_news_failure') ?? '').toUpperCase();

    const sources = sourceParams
      .flatMap((s) => s.split(','))
      .map((s) => s.toUpperCase() as NewsSourceKey)
      .filter((s): s is NewsSourceKey => NEWS_SOURCES.includes(s));
    const sentiments = sentimentParams
      .map((s) => s.toUpperCase() as SentimentLabelKey)
      .filter((s): s is SentimentLabelKey => SENTIMENT_LABELS.includes(s));

    let filtered = filterArticles({
      source: sources.length ? sources : undefined,
      sentiment: sentiments.length ? sentiments : undefined,
      ticker,
      fromIso,
      toIso,
    });

    const source_errors: NewsSourceKey[] = [];
    if (failureParam && (NEWS_SOURCES as readonly string[]).includes(failureParam)) {
      const broken = failureParam as NewsSourceKey;
      filtered = filtered.filter((a) => a.source !== broken);
      source_errors.push(broken);
    }

    const items = filtered.slice(offset, offset + limit);
    const data: NewsListResponse = {
      items,
      total: filtered.length,
      limit,
      offset,
      source_errors,
    };
    return HttpResponse.json(ok(data));
  }),

  // GET /api/news/sentiment/:ticker — 30-day rollup. GUARD-08: count=0 → NEUTRAL/0.0.
  http.get('/api/news/sentiment/:ticker', ({ params, request }) => {
    const ticker = (params.ticker as string).toUpperCase();
    const url = new URL(request.url);
    const windowDays = Math.max(1, Math.min(365, Number(url.searchParams.get('days') ?? 30)));

    // Anchor to the news fixture's "now" (2026-05-07), NOT wall-clock — otherwise users running
    // the app on a different date would always see count=0 (false GUARD-08 fallback).
    const sinceMs = FIXTURE_NOW_MS - windowDays * 24 * 60 * 60 * 1000;
    // `published_at` is ISO so string compare with sinceIso is safe.
    const sinceIso = new Date(sinceMs).toISOString();
    const articles = NEWS_CORPUS.filter(
      (a) => a.related_tickers.includes(ticker) && !!a.published_at && a.published_at >= sinceIso,
    );

    if (articles.length === 0) {
      // GUARD-08: no articles in window → NEUTRAL/0.0.
      const data: SentimentSummaryResponse = {
        ticker,
        window_days: windowDays,
        count: 0,
        label: 'NEUTRAL',
        score: 0.0,
        breakdown: SENTIMENT_LABELS.map((l) => ({ label: l, count: 0 })),
        source_breakdown: NEWS_SOURCES.map((s) => ({ source: s, count: 0 })),
      };
      return HttpResponse.json(ok(data));
    }

    const breakdownMap: Record<SentimentLabelKey, number> = {
      POSITIVE: 0,
      NEUTRAL: 0,
      NEGATIVE: 0,
    };
    const sourceMap: Record<NewsSourceKey, number> = {
      CAFEF: 0,
      VNEXPRESS: 0,
      VIETSTOCK: 0,
      BATDONGSAN: 0,
      THANHNIEN: 0,
    };
    let scoreSum = 0;
    for (const a of articles) {
      breakdownMap[a.sentiment_label] += 1;
      sourceMap[a.source] += 1;
      scoreSum += a.sentiment_score;
    }
    const avg = Number((scoreSum / articles.length).toFixed(2));
    // Map avg back to label using ±0.20 thresholds (matches scoreFromLabel ranges).
    const label: SentimentLabelKey = avg >= 0.20 ? 'POSITIVE' : avg <= -0.20 ? 'NEGATIVE' : 'NEUTRAL';

    const data: SentimentSummaryResponse = {
      ticker,
      window_days: windowDays,
      count: articles.length,
      label,
      score: avg,
      breakdown: SENTIMENT_LABELS.map((l) => ({ label: l, count: breakdownMap[l] })),
      source_breakdown: NEWS_SOURCES.map((s) => ({ source: s, count: sourceMap[s] })),
    };
    return HttpResponse.json(ok(data));
  }),

  // ---------- Cluster 5: Portfolio CRUD ----------

  http.get('/api/portfolio', () => {
    const data: PortfolioListResponse = { items: portfolioStore.list() };
    return HttpResponse.json(ok(data));
  }),

  http.post('/api/portfolio', async ({ request }) => {
    let body: Partial<PortfolioCreateRequest>;
    try {
      body = (await request.json()) as Partial<PortfolioCreateRequest>;
    } catch {
      return HttpResponse.json(err('VALIDATION_ERROR', 'Body JSON không hợp lệ.'), { status: 400 });
    }
    const errors = validateHolding(body);
    if (errors) {
      return HttpResponse.json(err('VALIDATION_ERROR', errors), { status: 400 });
    }
    const row = portfolioStore.add({
      ticker: body.ticker as string,
      quantity: body.quantity as number,
      buy_price: body.buy_price as number,
      buy_date: body.buy_date as string,
      notes: body.notes ?? null,
    });
    return HttpResponse.json(ok<PortfolioHolding>(row), { status: 201 });
  }),

  http.put('/api/portfolio/:id', async ({ params, request }) => {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return HttpResponse.json(err('VALIDATION_ERROR', 'ID không hợp lệ.'), { status: 400 });
    }
    let body: Partial<PortfolioUpdateRequest>;
    try {
      body = (await request.json()) as Partial<PortfolioUpdateRequest>;
    } catch {
      return HttpResponse.json(err('VALIDATION_ERROR', 'Body JSON không hợp lệ.'), { status: 400 });
    }
    // Pull current row to merge before validating (PUT here doubles as upsert/PATCH).
    const current = portfolioStore.get(id);
    if (!current) {
      return HttpResponse.json(err('NOT_FOUND', `Holding ${id} không tồn tại.`), { status: 404 });
    }
    const merged: Partial<PortfolioCreateRequest> = {
      ticker: body.ticker ?? current.ticker,
      quantity: body.quantity ?? current.quantity,
      buy_price: body.buy_price ?? current.buy_price,
      buy_date: body.buy_date ?? current.buy_date,
      notes: body.notes !== undefined ? body.notes : current.notes,
    };
    const errors = validateHolding(merged);
    if (errors) {
      return HttpResponse.json(err('VALIDATION_ERROR', errors), { status: 400 });
    }
    const updated = portfolioStore.update(id, {
      ticker: merged.ticker,
      quantity: merged.quantity,
      buy_price: merged.buy_price,
      buy_date: merged.buy_date,
      notes: merged.notes ?? null,
    });
    return HttpResponse.json(ok<PortfolioHolding>(updated as PortfolioHolding));
  }),

  http.delete('/api/portfolio/:id', ({ params }) => {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return HttpResponse.json(err('VALIDATION_ERROR', 'ID không hợp lệ.'), { status: 400 });
    }
    const removed = portfolioStore.remove(id);
    if (!removed) {
      return HttpResponse.json(err('NOT_FOUND', `Holding ${id} không tồn tại.`), { status: 404 });
    }
    // 200 + envelope (apiFetch parses body) — semantically equivalent to spec's 204.
    return HttpResponse.json(ok({ deleted: true }));
  }),

  // ---------- Cluster 5: Compare 2 runs ----------

  http.get('/api/runs/:run_a/compare/:run_b', ({ params }) => {
    const aId = params.run_a as string;
    const bId = params.run_b as string;
    if (aId === bId) {
      return HttpResponse.json(
        err('VALIDATION_ERROR', 'Hai run trong compare phải khác nhau.'),
        { status: 400 },
      );
    }
    const a = runsStore.get(aId);
    const b = runsStore.get(bId);
    if (!a || !b) {
      return HttpResponse.json(
        err('NOT_FOUND', `Run ${!a ? aId : bId} không tồn tại.`),
        { status: 404 },
      );
    }
    if (!a.computed || !b.computed) {
      return HttpResponse.json(err('NOT_READY', 'Một trong hai run chưa hoàn thành.'), {
        status: 409,
      });
    }
    const aSummary = runsStore.summary(aId);
    const bSummary = runsStore.summary(bId);
    if (!aSummary || !bSummary) {
      return HttpResponse.json(err('NOT_FOUND', 'Không lấy được summary.'), { status: 404 });
    }
    const diff: CompareResponse = computeCompare({
      run_a: { run_id: aId, run_at: a.run_at, summary: aSummary, computed: a.computed },
      run_b: { run_id: bId, run_at: b.run_at, summary: bSummary, computed: b.computed },
    });
    return HttpResponse.json(ok(diff));
  }),

  // ---------- Cluster 5: Run delete ----------

  http.delete('/api/runs/:run_id', ({ params }) => {
    const run_id = params.run_id as string;
    const removed = runsStore.delete(run_id);
    if (!removed) {
      return HttpResponse.json(err('NOT_FOUND', `Run ${run_id} không tồn tại.`), { status: 404 });
    }
    return HttpResponse.json(ok({ deleted: true }));
  }),

  // ---------- Cluster 5: Backtest ----------

  http.post('/api/backtest', async ({ request }) => {
    let body: Partial<BacktestStartRequest>;
    try {
      body = (await request.json()) as Partial<BacktestStartRequest>;
    } catch {
      return HttpResponse.json(err('VALIDATION_ERROR', 'Body JSON không hợp lệ.'), { status: 400 });
    }
    const error = validateBacktest(body);
    if (error) {
      return HttpResponse.json(err('VALIDATION_ERROR', error), { status: 400 });
    }
    const record = backtestStore.start({
      period_from: body.period_from as string,
      period_to: body.period_to as string,
    });
    const data: BacktestStartResponse = {
      backtest_id: record.backtest_id,
      status: record.status,
    };
    return HttpResponse.json(ok(data), { status: 202 });
  }),

  http.get('/api/backtest/:id/status', ({ params }) => {
    const id = Number(params.id);
    const r = backtestStore.get(id);
    if (!r) {
      return HttpResponse.json(err('NOT_FOUND', `Backtest ${id} không tồn tại.`), { status: 404 });
    }
    // Phase 9 align with backend Phase 8 shape: {backtest_id, status, started_at, completed_at}.
    // MSW backtest-store doesn't track timestamps in the prototype — emit null.
    const data: BacktestStatusResponse = {
      backtest_id: r.backtest_id,
      status: r.status,
      started_at: null,
      completed_at: null,
    };
    return HttpResponse.json(ok(data));
  }),

  http.get('/api/backtest/:id', ({ params }) => {
    const id = Number(params.id);
    const r = backtestStore.get(id);
    if (!r) {
      return HttpResponse.json(err('NOT_FOUND', `Backtest ${id} không tồn tại.`), { status: 404 });
    }
    if (!r.metrics) {
      return HttpResponse.json(err('NOT_READY', 'Backtest chưa hoàn thành.'), { status: 409 });
    }
    return HttpResponse.json(ok<BacktestMetrics>(r.metrics));
  }),

  http.get('/api/backtest/:id/results', ({ params }) => {
    const id = Number(params.id);
    const r = backtestStore.get(id);
    if (!r) {
      return HttpResponse.json(err('NOT_FOUND', `Backtest ${id} không tồn tại.`), { status: 404 });
    }
    if (!r.results) {
      return HttpResponse.json(err('NOT_READY', 'Backtest chưa hoàn thành.'), { status: 409 });
    }
    const data: BacktestResultsResponse = {
      results: r.results,
    };
    return HttpResponse.json(ok(data));
  }),

  // ---------- Cluster 6: Export PDF ----------

  // GET /api/export/pdf/:run_id — returns HTML body served as application/pdf so the
  // browser triggers a download. PDF MVP is text/table only (TAD c06 §1).
  http.get('/api/export/pdf/:run_id', ({ params }) => {
    const run_id = params.run_id as string;
    const r = runsStore.get(run_id);
    if (!r) {
      return HttpResponse.json(err('NOT_FOUND', `Run ${run_id} không tồn tại.`), { status: 404 });
    }
    if (!r.computed) {
      return HttpResponse.json(err('NOT_READY', 'Run chưa hoàn thành.'), { status: 409 });
    }
    const summary = runsStore.summary(run_id);
    const dashboard = runsStore.dashboard(run_id);
    if (!summary || !dashboard) {
      return HttpResponse.json(err('NOT_READY', 'Không đủ dữ liệu để xuất.'), { status: 409 });
    }
    const html = buildPdfHtml({
      summary,
      dashboard,
      results: r.computed.results,
      excluded: r.computed.excluded,
      brand: 'Vietnam Real Estate Equity Screening Report',
      tagline: 'Founder: Ngô Minh Tú — Dữ liệu dẫn đường, quyết định thuộc về bạn!',
    });
    return new HttpResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="run-${run_id}.pdf"`,
        'Cache-Control': 'no-store, max-age=0',
        Pragma: 'no-cache',
      },
    });
  }),

  // ---------- Cluster 6: Share Links ----------

  http.get('/api/share', () => {
    // Drop expired so settings management never lists stale tokens.
    const live = shareStore.list().filter((l) => !shareStore.isExpired(l));
    const data: ShareListResponse = { items: live };
    return HttpResponse.json(ok(data));
  }),

  http.post('/api/share', async ({ request }) => {
    let body: Partial<ShareCreateRequest>;
    try {
      body = (await request.json()) as Partial<ShareCreateRequest>;
    } catch {
      return HttpResponse.json(err('VALIDATION_ERROR', 'Body JSON không hợp lệ.'), { status: 400 });
    }
    if (!body.run_id || typeof body.run_id !== 'string') {
      return HttpResponse.json(err('VALIDATION_ERROR', 'Thiếu run_id.'), { status: 400 });
    }
    const r = runsStore.get(body.run_id);
    if (!r) {
      return HttpResponse.json(err('NOT_FOUND', `Run ${body.run_id} không tồn tại.`), { status: 404 });
    }
    if (!r.computed) {
      return HttpResponse.json(err('NOT_READY', 'Run chưa hoàn thành.'), { status: 409 });
    }
    const days =
      typeof body.expires_in_days === 'number' && body.expires_in_days > 0
        ? Math.min(30, Math.floor(body.expires_in_days))
        : 7;
    const link = shareStore.create(body.run_id, days);
    return HttpResponse.json(ok<ShareCreateResponse>(link), { status: 201 });
  }),

  http.get('/api/share/:token', ({ params }) => {
    const token = params.token as string;
    const link = shareStore.get(token);
    if (!link) {
      return HttpResponse.json(err('NOT_FOUND', 'Link không tồn tại hoặc đã bị thu hồi.'), {
        status: 404,
      });
    }
    if (shareStore.isExpired(link)) {
      return HttpResponse.json(err('EXPIRED', 'Link đã hết hạn.'), { status: 410 });
    }
    const r = runsStore.get(link.run_id);
    const summary = runsStore.summary(link.run_id);
    const dashboard = runsStore.dashboard(link.run_id);
    if (!r || !r.computed || !summary || !dashboard) {
      return HttpResponse.json(err('NOT_FOUND', 'Run gốc đã bị xóa.'), { status: 404 });
    }
    // Phase 9 align with backend Phase 8 shape (TAD g02 §9.2): {token, run_id, expires_at, data}.
    const muaResults = r.computed.results.filter((row) => row.recommendation === 'MUA').slice(0, 10);
    const data: SharedViewResponse = {
      token: link.token,
      run_id: link.run_id,
      expires_at: link.expires_at,
      data: {
        summary: {
          total_scored: summary.scored_count,
          total_buy: summary.buy_count,
          total_hold: summary.hold_count,
          total_sell: summary.sell_count,
        },
        dashboard,
        top_mua: muaResults,
      },
    };
    return HttpResponse.json(ok(data));
  }),

  http.delete('/api/share/:token', ({ params }) => {
    const token = params.token as string;
    const removed = shareStore.remove(token);
    if (!removed) {
      return HttpResponse.json(err('NOT_FOUND', 'Token không tồn tại.'), { status: 404 });
    }
    return HttpResponse.json(ok({ deleted: true }));
  }),

  // ---------- Cluster 6: Telegram test ----------

  // POST /api/telegram/test — random 70% success / 30% error (cluster prompt §5.2).
  http.post('/api/telegram/test', () => {
    const success = Math.random() < 0.7;
    const data: TelegramTestResponse = success
      ? { sent: true, error: null }
      : { sent: false, error: 'Bot token không hợp lệ hoặc chat_id sai. Vui lòng kiểm tra lại.' };
    return HttpResponse.json(ok(data));
  }),

  // ---------- Catch-all ----------
  http.all('/api/*', ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json(
      err(
        'NOT_IMPLEMENTED',
        `Endpoint ${request.method} ${url.pathname} chưa được mock. Sẽ implement trong cluster sau.`,
      ),
      { status: 404 },
    );
  }),
];
