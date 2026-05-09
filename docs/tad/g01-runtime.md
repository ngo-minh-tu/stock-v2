---
id: g01
title: Runtime — Two-Flow Architecture, Run State Machine, Sequence Diagrams
parent: 00-tad-system-overview.md
type: global
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§4, §5, §24); cluster 2 reconciliation 2026-05-09
version: v1.3 LOCKED (cluster 2 reconciliation)
---

# g01 — Runtime

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)

## Changelog

- **v1.3 (2026-05-09, cluster 2 reconciliation):** ➕ Bổ sung §4 Frontend Polling & Reload Pattern (`usePolling` hook với cancelledRef, `useApiResource` GET-once + reloadKey, `lastCompletedRunId` broadcast). §5 Prototype 5-step state machine alignment với 7-state backend enum.

---

## 1. Two-Flow Architecture: Refresh vs Screening

### Flow 1: Refresh Data

```
POST /api/refresh/all → 202 Accepted + refresh_id
Backend: check stale → fetch vnstock → crawl macro → crawl news → sentiment → save → update cache_metadata
Frontend: poll /api/refresh/{id}/status
Result: data updated in DB, cache timestamps refreshed
```

PO có thể refresh 1 lần/ngày. Screening dùng latest cached data.

### Refresh Job Status Storage (MVP)

> [v1.1 PATCH] Refresh job status lưu **in-memory job registry** cho MVP. Không thêm bảng `refresh_jobs` trong SQLite để giữ scope gọn.

**Rule:**
- `POST /api/refresh/all` tạo `refresh_id` và lưu trạng thái vào in-memory registry.
- `GET /api/refresh/{id}/status` đọc trạng thái từ in-memory registry.
- Nếu backend restart khi refresh đang chạy, trạng thái refresh có thể mất. Đây là acceptable trade-off cho local personal MVP.
- Sau khi refresh hoàn thành, dữ liệu thật đã được lưu vào DB/cache tables; chỉ progress/status tạm thời là in-memory.
- Nếu cần production/beta multi-user sau này, nâng cấp sang bảng `refresh_jobs` hoặc job queue persistent.

### Flow 2: Run Screening

> [v1.1 FIX] Screening KHÔNG fetch external. Chỉ đọc DB/cache.

```
POST /api/run → 202 Accepted + run_id
Backend: load cache → 4 vòng lọc → features → scoring → price → entry → risk → save
Frontend: poll /api/runs/{run_id}/status
After COMPLETED: fetch /api/runs/{run_id}/dashboard, /results, etc.
```

### First-Run Safety

Nếu chưa ever refresh:
- POST /run detect empty DB → return 400 với message "Vui lòng Cập nhật dữ liệu trước"
- Frontend hiển thị nút "Cập nhật dữ liệu" thay vì nút "Chạy"

---

## 2. Run State Machine & Async Behavior

> [v1.1 MUST-FIX 1 + 3] Chốt async + đồng bộ enum

### 2.1 RunStatus Enum (canonical — cả SRS và TAD dùng chung)

```python
class RunStatus(str, Enum):
    PENDING = "PENDING"
    CHECKING_DATA = "CHECKING_DATA"
    SCREENING = "SCREENING"
    SCORING = "SCORING"
    COMPLETED = "COMPLETED"
    COMPLETED_WITH_WARNINGS = "COMPLETED_WITH_WARNINGS"
    FAILED = "FAILED"
```

Note: [SRS g03 §G Appendix](../srs/g03-appendix-enums-constants.md) ghi 3 states (RUNNING/COMPLETED/FAILED) — đây là simplified view. Implementation dùng 7 states ở trên. RUNNING trong SRS = CHECKING_DATA | SCREENING | SCORING trong TAD.

### 2.2 Async Flow

```
POST /api/run
  → Validate input
  → Create screening_runs record (status=PENDING)
  → Start background task
  → Return 202 Accepted: {"run_id": "...", "status": "PENDING"}

Background task:
  → Update status CHECKING_DATA → SCREENING → SCORING
  → On success: COMPLETED or COMPLETED_WITH_WARNINGS
  → On crash: FAILED + error logged

GET /api/runs/{run_id}/status
  → Return current status + progress_percent + message + warnings

GET /api/runs/{run_id}/results     [v1.1 NEW]
  → Return full results array (only after COMPLETED/COMPLETED_WITH_WARNINGS)

GET /api/runs/{run_id}/dashboard
  → Return aggregate data for 5 charts + 5 KPI cards
```

**Frontend poll interval:** 2 giây. Dừng poll khi status = COMPLETED | COMPLETED_WITH_WARNINGS | FAILED.

### 2.3 COMPLETED_WITH_WARNINGS khi:

- data_from_cache = true (stale data)
- Telegram gửi lỗi
- 1-4 nguồn tin lỗi
- ≥1 mã có imputed features

---

## 3. Sequence Diagrams

### Manual Run (Async)

```
PO          Frontend           Backend              DB
│            │                  │                    │
│ Click Run  │                  │                    │
│───────────>│ POST /run        │                    │
│            │─────────────────>│ Create run PENDING │
│            │                  │───────────────────>│
│            │ 202 {run_id}     │                    │
│            │<─────────────────│                    │
│            │                  │                    │
│            │ Poll /status     │ [Background Task]  │
│            │─────────────────>│ CHECKING→SCREENING │
│            │ {SCREENING, 30%} │ →SCORING           │
│            │<─────────────────│                    │
│            │                  │                    │
│            │ Poll /status     │                    │
│            │─────────────────>│ COMPLETED          │
│            │ {COMPLETED}      │                    │
│            │<─────────────────│                    │
│            │                  │                    │
│            │ GET /dashboard   │                    │
│            │─────────────────>│ Query results      │
│            │                  │───────────────────>│
│            │ {aggregate}      │                    │
│            │<─────────────────│                    │
│ Show UI    │                  │                    │
│<───────────│                  │                    │
```

### Refresh Data

```
PO          Frontend           Backend              External
│            │                  │                    │
│ Click Refresh│                │                    │
│───────────>│ POST /refresh    │                    │
│            │─────────────────>│ Check locks        │
│            │ 202 {refresh_id} │                    │
│            │<─────────────────│                    │
│            │                  │ [Background]       │
│            │ Poll /status     │ vnstock (0.5s/call)│
│            │─────────────────>│───────────────────>│
│            │ {progress 40%}   │                    │
│            │<─────────────────│ RSS crawl          │
│            │                  │───────────────────>│
│            │ Poll /status     │                    │
│            │─────────────────>│ COMPLETED          │
│            │<─────────────────│                    │
│ "Đã cập nhật"│               │                    │
│<───────────│                  │                    │
```

---

## 4. Frontend Polling & Reload Pattern

> [v1.3] Chốt từ cluster 2 prototype

### 4.1 `usePolling<T>` hook

Polling endpoint với auto-stop khi đạt terminal state. Implement:

```ts
// frontend/src/lib/hooks/usePolling.ts
type PollingOptions<T> = {
  intervalMs: number;          // default 2000 (chuẩn TAD g01 §2.2)
  isTerminal: (data: T) => boolean;
  enabled: boolean;            // gate polling on/off
};

export function usePolling<T>(path: string, opts: PollingOptions<T>) {
  const cancelledRef = useRef(false);  // chống late-fire sau unmount
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    if (!opts.enabled) return;
    cancelledRef.current = false;

    const tick = async () => {
      if (cancelledRef.current) return;
      const fresh = await apiFetch<T>(path);
      if (cancelledRef.current) return;
      setData(fresh);
      if (opts.isTerminal(fresh)) return;  // auto-stop
      setTimeout(tick, opts.intervalMs);
    };
    tick();

    return () => { cancelledRef.current = true; };
  }, [path, opts.enabled]);

  return data;
}
```

**Critical patterns:**
- `cancelledRef` (KHÔNG `useState`) — block mọi `setState` sau unmount; nếu dùng state, effect deps thay đổi → re-run → setTimeout của chính nó bị clear trước khi auto-dismiss
- `enabled` gate — caller có thể tắt polling khi không cần (vd: user navigate away)
- Auto-stop khi `isTerminal(data)` → không poll vô hạn

**Caller pattern (RunContext):**
```ts
const status = usePolling<RunStatusResponse>(
  `/api/runs/${activeRunId}/status`,
  {
    intervalMs: 2000,
    isTerminal: (s) => RUN_TERMINAL_STATES.includes(s.status),
    enabled: !!activeRunId,
  },
);
```

### 4.2 `useApiResource<T>` hook

GET-once với reload trigger qua `reloadKey`. Cancel-on-unmount.

```ts
// frontend/src/lib/hooks/useApiResource.ts
export function useApiResource<T>(path: string, reloadKey: number = 0) {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: Error | null;
  }>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState(s => ({ ...s, loading: true }));
    apiFetch<T>(path)
      .then(data => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch(error => { if (!cancelled) setState({ data: null, loading: false, error }); });
    return () => { cancelled = true; };
  }, [path, reloadKey]);

  return state;
}
```

**Tại sao tự viết, không dùng SWR:**
- Cluster 2 chỉ cần 1 endpoint polling + GET-once. SWR ~20KB bloat.
- Pattern đơn giản, không cần caching/dedupe của SWR.
- Cancel logic explicit hơn SWR's revalidation lifecycle.

### 4.3 `lastCompletedRunId` Broadcast

`RunContext` expose `lastCompletedRunId` — set sau khi run chuyển terminal state thành COMPLETED hoặc COMPLETED_WITH_WARNINGS.

Dashboard, TopMUA, RedFlags listen qua `useEffect` → bump local `reloadKey` → `useApiResource` re-fetch tự động.

```tsx
// Page pattern
const { lastCompletedRunId } = useRun();
const [reloadKey, setReloadKey] = useState(0);

useEffect(() => {
  if (lastCompletedRunId) setReloadKey(k => k + 1);
}, [lastCompletedRunId]);

const { data } = useApiResource<TopMuaData>(
  `/api/runs/${runId}/results`,
  reloadKey,
);
```

→ Khi user trigger run mới và run hoàn thành, **mọi page đang mở tự reload** mà không cần manual F5 hay navigate.

### 4.4 RunContext Auto-Dismiss Timer

Khi run chuyển terminal, `RunContext` fire toast + clear `activeRunId` sau timer (3s success/warnings, 4s failed):

```ts
// Critical: dùng captured runId trong functional setState
const capturedRunId = activeRunId;
setTimeout(() => {
  setActiveRunId(prev => prev === capturedRunId ? null : prev);
  // Không clear nếu user đã start run khác (prev !== captured)
}, dismissMs);
```

**Lý do functional setState:** chống case run A timer fire sau khi user đã start run B → nếu unconditional clear, sẽ wipe state run B.

**Critical: `handledRunRef` dùng `useRef` (KHÔNG `useState`)** — đây là "đã fire toast cho run này chưa" flag. Nếu dùng state, effect deps thay đổi → tự re-run → clear setTimeout của chính nó.

---

## 5. Prototype 5-Step Mock vs Backend 7-State

Backend canonical RunStatus có 7 values (xem §2.1 trên). Prototype MSW mock hiện 5 transitions:

```
PENDING (0ms, 5%)
  → CHECKING_DATA (2000ms, 15%)
  → SCREENING (5000ms, 40%)
  → SCORING (10000ms, 75%)
  → terminal (15000ms): COMPLETED | COMPLETED_WITH_WARNINGS | FAILED
```

→ Prototype state set là **subset** của 7-state enum (4 progress states + 3 terminal). Không có state mới nào nằm ngoài enum. MVP backend khi ship sẽ dùng nguyên 7 states qua FastAPI background task.

**Verify match:** `RUN_TERMINAL_STATES` constant trong [g03 §L Frontend Constants](../srs/g03-appendix-enums-constants.md) = `{COMPLETED, COMPLETED_WITH_WARNINGS, FAILED}` — usePolling.isTerminal check theo set này.
