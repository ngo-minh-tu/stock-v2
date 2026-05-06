// MSW handlers for the 6 cluster-1 endpoints + a catch-all 404 for unimplemented routes.
// Response envelope follows TAD g05 §3.

import { http, HttpResponse } from 'msw';

import { MOCK_JWT_PREFIX } from '@/lib/constants';
import type { ApiSuccess, ApiError, HealthResponseData, LoginResponseData } from '@/lib/types';

import { getSettings, patchSettings } from './data/settings';
import { versionPayload } from './data/version';

function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

function err(code: string, message: string, detail?: string): ApiError {
  return { success: false, error: { code, message, ...(detail ? { detail } : {}) } };
}

export const handlers = [
  // POST /api/auth/login (c08 §2)
  http.post('/api/auth/login', async () => {
    const data: LoginResponseData = {
      token: `${MOCK_JWT_PREFIX}${Date.now()}`,
      expires_in: 86400,
    };
    return HttpResponse.json(ok(data));
  }),

  // PUT /api/auth/password (c08 §2)
  http.put('/api/auth/password', async () => {
    return HttpResponse.json(ok({ changed: true }));
  }),

  // GET /api/version (g02 §3)
  http.get('/api/version', () => {
    return HttpResponse.json(ok(versionPayload));
  }),

  // GET /api/health (g02 §3)
  http.get('/api/health', () => {
    const data: HealthResponseData = { status: 'ok', active_job: null };
    return HttpResponse.json(ok(data));
  }),

  // GET /api/settings (SRS f15)
  http.get('/api/settings', () => {
    return HttpResponse.json(ok(getSettings()));
  }),

  // PUT /api/settings — echoes patch with bumped settings_version + updated_at
  http.put('/api/settings', async ({ request }) => {
    let patch: Record<string, unknown> = {};
    try {
      patch = (await request.json()) as Record<string, unknown>;
    } catch {
      return HttpResponse.json(err('VALIDATION_ERROR', 'Invalid JSON body'), { status: 400 });
    }
    return HttpResponse.json(ok(patchSettings(patch)));
  }),

  // Catch-all for unmocked /api/* routes — keeps cluster 1 honest about scope.
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
