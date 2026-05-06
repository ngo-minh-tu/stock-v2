---
id: g01
title: Runtime — Two-Flow Architecture, Run State Machine, Sequence Diagrams
parent: 00-tad-system-overview.md
type: global
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§4, §5, §24)
---

# g01 — Runtime

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)

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

Note: SRS v1.0 Appendix ghi 3 states (RUNNING/COMPLETED/FAILED) — đây là simplified view. Implementation dùng 7 states ở trên. RUNNING trong SRS = CHECKING_DATA | SCREENING | SCORING trong TAD.

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
  → Return aggregate data for 6 charts + KPIs
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
