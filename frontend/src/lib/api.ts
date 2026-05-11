// fetch wrapper. Auto-attaches JWT (Bearer), parses {success,data}|{success,error} envelope (g05 §3).
// 401 → clear token + redirect /login. 409 → throw JobConflictError (cluster 2 will use it).
//
// Phase 9 (FE swap MSW → real backend):
// - Path argument starts with `/api/...` (cluster pattern unchanged).
// - When `NEXT_PUBLIC_API_BASE_URL` is set (e.g. `http://localhost:8000`), it is prepended.
// - When unset/empty, the path stays relative — MSW worker (if registered) intercepts, OR
//   the request hits the same Next origin (no-op if no proxy). Default Phase 9 deployment
//   sets the env var to the FastAPI host so MSW is bypassed entirely.

import { STORAGE_KEYS } from './constants';
import type { ApiEnvelope } from './types';

// Strip trailing slash to keep `${BASE}${path}` clean (path always has leading `/`).
const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');

function resolveUrl(path: string): string {
  if (!BASE_URL) return path;
  // Absolute URL passes through unchanged (e.g. external resource).
  if (/^https?:\/\//i.test(path)) return path;
  return `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export class ApiError extends Error {
  code: string;
  status: number;
  detail?: string;
  constructor(code: string, message: string, status: number, detail?: string) {
    super(message);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

export class JobConflictError extends ApiError {
  constructor(message: string, detail?: string) {
    super('JOB_CONFLICT', message, 409, detail);
    this.name = 'JobConflictError';
  }
}

function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEYS.token);
}

function clearTokenAndRedirect() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEYS.token);
  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

export async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = readToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(resolveUrl(path), { ...opts, headers });

  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError('PARSE_ERROR', `Cannot parse response (status ${res.status})`, res.status);
  }

  if (res.status === 401) {
    clearTokenAndRedirect();
    const msg = body && !body.success ? body.error.message : 'Unauthorized';
    throw new ApiError('UNAUTHORIZED', msg, 401);
  }

  if (!body.success) {
    if (res.status === 409 || body.error.code === 'JOB_CONFLICT') {
      throw new JobConflictError(body.error.message, body.error.detail);
    }
    throw new ApiError(body.error.code, body.error.message, res.status, body.error.detail);
  }

  return body.data;
}
