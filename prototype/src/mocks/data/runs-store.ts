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

class RunsStore {
  private runs = new Map<string, RunRecord>();
  private order: string[] = []; // insertion order for /api/runs list
  private active: string | null = null;

  constructor() {
    // Seed 3 historical completed runs so /api/runs is non-empty on first load.
    const now = Date.now();
    for (let i = 0; i < 3; i += 1) {
      const id = `run_seed_${i + 1}`;
      const run_at = new Date(now - (3 - i) * 86_400_000).toISOString();
      const computed = computeRun({
        run_id: id,
        master_seed: 7000 + i * 1000,
        total_capital: 500_000_000,
      });
      this.runs.set(id, {
        run_id: id,
        run_at,
        status: i === 1 ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED',
        progress_percent: 100,
        current_step: 'Hoàn thành',
        warnings:
          i === 1
            ? [
                { code: 'data_from_cache', message: 'Dữ liệu sử dụng cache 24h' },
                { code: 'partial_news', message: '1/5 nguồn tin lỗi' },
              ]
            : [],
        run_error: null,
        total_capital: 500_000_000,
        outcome: i === 1 ? 'warnings' : 'success',
        computed,
        timers: [],
      });
      this.order.push(id);
    }
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
      };
    }
    return {
      ...r.computed.summary,
      run_at: r.run_at,
      status: r.status,
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
    const record: RunRecord = {
      run_id: id,
      run_at: new Date().toISOString(),
      status: 'PENDING',
      progress_percent: 5,
      current_step: 'Khởi tạo run',
      warnings: [],
      run_error: null,
      total_capital: args.total_capital,
      outcome: args.outcome,
      computed: null,
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
        this.active = null;
        return;
      }

      // Compute results now (cheap on 81 mã).
      r.computed = computeRun({
        run_id: r.run_id,
        master_seed: Date.now() % 100_000,
        total_capital: r.total_capital,
      });

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
      r.progress_percent = 100;
      r.current_step = 'Hoàn thành';
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
