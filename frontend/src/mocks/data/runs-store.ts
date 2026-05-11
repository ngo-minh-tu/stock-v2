// Singleton in-memory runs registry — handlers share state via this module
// (cluster-2 prompt §11). Simulates the run state machine with setTimeout transitions.

import type { RunStatus } from '@/lib/constants';
import type { DashboardResponse, RunSummary, RunWarning } from '@/lib/types';

import { computeRun, type ComputedRun } from './run-compute';

export type RunOutcomeMode = 'success' | 'warnings' | 'failed';

export interface RunRecord {
  run_id: string;
  run_at: string;
  status: RunStatus;
  progress_percent: number;
  current_step: string;
  warnings: RunWarning[];
  run_error: string | null;
  total_capital: number;
  outcome: RunOutcomeMode;
  computed: ComputedRun | null; // populated once SCORING completes
  // Cluster 5 metadata for Run History table.
  model_version: string;
  settings_version: number;
  duration_seconds: number; // wall-clock duration; for active runs, computed from start time on read
  started_at_ms: number;     // for live duration calc
  // Track the underlying setTimeout handles so we can cancel on hot reload (rare in dev).
  timers: ReturnType<typeof setTimeout>[];
}

const STATE_TRANSITIONS: { delayMs: number; status: RunStatus; progress: number; step: string }[] = [
  { delayMs: 0, status: 'PENDING', progress: 5, step: 'Khởi tạo run' },
  { delayMs: 2000, status: 'CHECKING_DATA', progress: 15, step: 'Kiểm tra dữ liệu cache' },
  { delayMs: 5000, status: 'SCREENING', progress: 40, step: 'Lọc 81 mã qua 4 vòng' },
  { delayMs: 10000, status: 'SCORING', progress: 75, step: 'Chấm điểm AI features' },
];

const FINAL_DELAY_MS = 15000;

// Seed configuration — 7 historical pre-baked runs (cluster 5 prompt §6.2).
// Mix of model_version, settings_version, total_capital, run_at, outcome.
interface SeedSpec {
  daysAgo: number;
  model_version: string;
  settings_version: number;
  total_capital: number;
  outcome: RunOutcomeMode;
  duration_seconds: number;
}
const SEED_SPECS: SeedSpec[] = [
  { daysAgo: 28, model_version: 'baseline_v1', settings_version: 1, total_capital: 300_000_000, outcome: 'success', duration_seconds: 13 },
  { daysAgo: 22, model_version: 'baseline_v1', settings_version: 1, total_capital: 500_000_000, outcome: 'warnings', duration_seconds: 24 },
  { daysAgo: 17, model_version: 'baseline_v1', settings_version: 1, total_capital: 500_000_000, outcome: 'success', duration_seconds: 16 },
  { daysAgo: 11, model_version: 'baseline_v2', settings_version: 2, total_capital: 750_000_000, outcome: 'success', duration_seconds: 19 },
  { daysAgo: 7, model_version: 'baseline_v2', settings_version: 2, total_capital: 500_000_000, outcome: 'warnings', duration_seconds: 21 },
  { daysAgo: 3, model_version: 'baseline_v2', settings_version: 2, total_capital: 600_000_000, outcome: 'success', duration_seconds: 14 },
  { daysAgo: 1, model_version: 'baseline_v2', settings_version: 2, total_capital: 500_000_000, outcome: 'success', duration_seconds: 17 },
];

class RunsStore {
  private runs = new Map<string, RunRecord>();
  private order: string[] = []; // insertion order for /api/runs list
  private active: string | null = null;

  constructor() {
    // Seed 7 historical completed runs (cluster 5 §6.2): mix of model_version + settings_version.
    const now = Date.now();
    SEED_SPECS.forEach((spec, i) => {
      const id = `run_seed_${i + 1}`;
      const run_at = new Date(now - spec.daysAgo * 86_400_000).toISOString();
      const computed = computeRun({
        run_id: id,
        master_seed: 7000 + i * 1000,
        total_capital: spec.total_capital,
      });
      // Override summary metadata with the seed's varied values.
      computed.summary.model_version = spec.model_version;
      computed.summary.settings_version = spec.settings_version;
      computed.summary.duration_seconds = spec.duration_seconds;
      const warnings: RunWarning[] =
        spec.outcome === 'warnings'
          ? [
              { code: 'data_from_cache', message: 'Dữ liệu sử dụng cache 24h' },
              { code: 'partial_news', message: '1/5 nguồn tin lỗi' },
            ]
          : [];
      computed.summary.warnings_count = warnings.length;
      if (spec.outcome === 'warnings') computed.summary.data_from_cache = true;

      this.runs.set(id, {
        run_id: id,
        run_at,
        status: spec.outcome === 'warnings' ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED',
        progress_percent: 100,
        current_step: 'Hoàn thành',
        warnings,
        run_error: null,
        total_capital: spec.total_capital,
        outcome: spec.outcome,
        computed,
        model_version: spec.model_version,
        settings_version: spec.settings_version,
        duration_seconds: spec.duration_seconds,
        started_at_ms: now - spec.daysAgo * 86_400_000 - spec.duration_seconds * 1000,
        timers: [],
      });
      this.order.push(id);
    });
  }

  list(limit: number, offset: number): { items: RunSummary[]; total: number } {
    // Newest first.
    const ids = [...this.order].reverse();
    const slice = ids.slice(offset, offset + limit);
    const items = slice
      .map((id) => this.summary(id))
      .filter((s): s is RunSummary => s !== null);
    return { items, total: this.order.length };
  }

  latest(): RunRecord | null {
    for (let i = this.order.length - 1; i >= 0; i -= 1) {
      const r = this.runs.get(this.order[i]);
      if (r && r.computed) return r;
    }
    return null;
  }

  get(run_id: string): RunRecord | null {
    return this.runs.get(run_id) ?? null;
  }

  delete(run_id: string): boolean {
    if (!this.runs.has(run_id)) return false;
    // Cancel any pending timers so a deleted-then-recreated id doesn't leak callbacks.
    const r = this.runs.get(run_id)!;
    r.timers.forEach((t) => clearTimeout(t));
    this.runs.delete(run_id);
    this.order = this.order.filter((id) => id !== run_id);
    if (this.active === run_id) this.active = null;
    return true;
  }

  summary(run_id: string): RunSummary | null {
    const r = this.runs.get(run_id);
    if (!r) return null;
    if (!r.computed) {
      return {
        run_id: r.run_id,
        run_at: r.run_at,
        status: r.status,
        total_input: 81,
        scored_count: 0,
        buy_count: 0,
        hold_count: 0,
        sell_count: 0,
        total_capital: r.total_capital,
        data_from_cache: false,
        model_version: r.model_version,
        settings_version: r.settings_version,
        duration_seconds: Math.max(0, Math.floor((Date.now() - r.started_at_ms) / 1000)),
        warnings_count: r.warnings.length,
        avg_score: 0,
      };
    }
    return {
      ...r.computed.summary,
      run_at: r.run_at,
      status: r.status,
      model_version: r.model_version,
      settings_version: r.settings_version,
      duration_seconds: r.duration_seconds,
      warnings_count: r.warnings.length,
    };
  }

  dashboard(run_id: string): DashboardResponse | null {
    const r = this.runs.get(run_id);
    if (!r || !r.computed) return null;
    return { ...r.computed.dashboard, run_at: r.run_at };
  }

  /** Returns the active job id if any heavy job is running — used for 409 CONFLICT. */
  activeJob(): string | null {
    return this.active;
  }

  start(args: { total_capital: number; outcome: RunOutcomeMode }): RunRecord {
    const id = `run_${Date.now()}`;
    // Newer user-initiated runs adopt the latest model_version / settings_version.
    const model_version = 'baseline_v2';
    const settings_version = 2;
    const startedAtMs = Date.now();
    const record: RunRecord = {
      run_id: id,
      run_at: new Date(startedAtMs).toISOString(),
      status: 'PENDING',
      progress_percent: 5,
      current_step: 'Khởi tạo run',
      warnings: [],
      run_error: null,
      total_capital: args.total_capital,
      outcome: args.outcome,
      computed: null,
      model_version,
      settings_version,
      duration_seconds: 0,
      started_at_ms: startedAtMs,
      timers: [],
    };
    this.runs.set(id, record);
    this.order.push(id);
    this.active = id;
    this.scheduleTransitions(record);
    return record;
  }

  private scheduleTransitions(record: RunRecord) {
    STATE_TRANSITIONS.forEach((step) => {
      const t = setTimeout(() => {
        const r = this.runs.get(record.run_id);
        if (!r) return;
        r.status = step.status;
        r.progress_percent = step.progress;
        r.current_step = step.step;
      }, step.delayMs);
      record.timers.push(t);
    });

    const finalT = setTimeout(() => {
      const r = this.runs.get(record.run_id);
      if (!r) return;

      if (r.outcome === 'failed') {
        r.status = 'FAILED';
        r.progress_percent = 100;
        r.current_step = 'Đã dừng do lỗi';
        r.run_error = 'Mock failure for UX test';
        r.duration_seconds = Math.max(1, Math.round((Date.now() - r.started_at_ms) / 1000));
        this.active = null;
        return;
      }

      // Compute results now (cheap on 81 mã).
      r.computed = computeRun({
        run_id: r.run_id,
        master_seed: Date.now() % 100_000,
        total_capital: r.total_capital,
      });
      r.computed.summary.model_version = r.model_version;
      r.computed.summary.settings_version = r.settings_version;

      if (r.outcome === 'warnings') {
        r.status = 'COMPLETED_WITH_WARNINGS';
        r.warnings = [
          { code: 'data_from_cache', message: 'Dữ liệu sử dụng cache 24h' },
          { code: 'telegram_error', message: 'Telegram chat_id chưa cấu hình' },
        ];
        r.computed.summary.data_from_cache = true;
      } else {
        r.status = 'COMPLETED';
        r.warnings = [];
      }
      r.computed.summary.warnings_count = r.warnings.length;
      r.progress_percent = 100;
      r.current_step = 'Hoàn thành';
      r.duration_seconds = Math.max(1, Math.round((Date.now() - r.started_at_ms) / 1000));
      r.computed.summary.duration_seconds = r.duration_seconds;
      this.active = null;
    }, FINAL_DELAY_MS);
    record.timers.push(finalT);
  }
}

// Singleton — survives across MSW handler invocations within one tab session.
declare global {
  // eslint-disable-next-line no-var
  var __runsStore: RunsStore | undefined;
}

export const runsStore: RunsStore =
  globalThis.__runsStore ?? (globalThis.__runsStore = new RunsStore());
