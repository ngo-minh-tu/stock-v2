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
} from '@/lib/types';

import { getSettings, patchSettings } from './data/settings';
import { runsStore, type RunOutcomeMode } from './data/runs-store';
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
