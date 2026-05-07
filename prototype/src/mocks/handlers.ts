// MSW handlers — cluster 1 (auth/version/health/settings) + cluster 2 (run lifecycle).
// Response envelope follows TAD g05 §3.

import { http, HttpResponse } from 'msw';

import { MOCK_JWT_PREFIX } from '@/lib/constants';
import type {
  ApiSuccess,
  ApiError,
  DashboardResponse,
  HealthResponseData,
  LoginResponseData,
  RunResultsResponse,
  RunStartRequest,
  RunStartResponse,
  RunStatusResponse,
  RunSummary,
  RunsListResponse,
  StockDetailResponse,
  StockPricesResponse,
  StockStaticInfo,
  TickerRunsResponse,
} from '@/lib/types';

import { getPrices, type PricePeriod } from './data/prices-fixture';
import { getSettings, patchSettings } from './data/settings';
import { runsStore, type RunOutcomeMode } from './data/runs-store';
import { buildStockDetail } from './data/stock-detail-compute';
import { STOCK_FIXTURE } from './data/stocks-fixture';
import { versionPayload } from './data/version';

function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

function err(code: string, message: string, detail?: string): ApiError {
  return { success: false, error: { code, message, ...(detail ? { detail } : {}) } };
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

  http.put('/api/auth/password', async () => {
    return HttpResponse.json(ok({ changed: true }));
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
    const data: RunResultsResponse = {
      run_id: r.run_id,
      results: r.computed.results,
      excluded: r.computed.excluded,
      warnings: r.warnings,
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

  // GET /api/stocks/:ticker/prices?period=6M — synthetic OHLCV history.
  http.get('/api/stocks/:ticker/prices', ({ request, params }) => {
    const url = new URL(request.url);
    const ticker = (params.ticker as string).toUpperCase();
    const periodRaw = url.searchParams.get('period') ?? '6M';
    const period = (['1M', '3M', '6M', '1Y'].includes(periodRaw)
      ? periodRaw
      : '6M') as PricePeriod;

    // Anchor current_price from latest run when available so the chart's right edge
    // matches the header's displayed price.
    const latest = runsStore.latest();
    const fromRun = latest?.computed?.results.find((r) => r.ticker === ticker);
    const seed = STOCK_FIXTURE.find((s) => s.ticker === ticker);
    if (!seed) {
      return HttpResponse.json(err('NOT_FOUND', `Mã ${ticker} không tồn tại`), { status: 404 });
    }
    const currentPrice = fromRun?.current_price ?? 20 + (seed.seed % 50);
    const data = getPrices({ ticker, period, currentPrice });
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
