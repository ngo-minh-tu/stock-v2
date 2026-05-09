---
id: g06
title: Testing Strategy & Fixtures
parent: 00-tad-system-overview.md
type: global
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§22); cluster 2 reconciliation 2026-05-09
version: v1.3 LOCKED (cluster 2 reconciliation)
---

# g06 — Testing Strategy & Fixtures

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)

## Changelog

- **v1.3 (2026-05-09, cluster 2 reconciliation):** ➕ Bổ sung §3 81-Ticker Fixture (26 BĐS thật + 5 mock anchor + 50 filler), §4 Mulberry32 PRNG (reproducible mock results), §5 Reason Templates (13 mẫu kèm feature_id, GUARD-02 enforcement), §6 MSW Singleton Store Pattern (`globalThis.__runsStore`).

---

## 1. 5 Mock Tickers

| Ticker | Scenario | Expected |
|---|---|---|
| MOCK_BUY_STRONG | High score, good fundamentals | MUA, BUY_STRONG |
| MOCK_BUY_WARN | Score OK, D/E=3.2 | MUA, BUY_NOW, 1 badge, -5pp |
| MOCK_HOLD | Mixed signals | GIỮ, NO_ENTRY |
| MOCK_SELL | Negative growth, high debt | BÁN, NO_ENTRY |
| MOCK_INSUFFICIENT | Missing indicators | INSUFFICIENT_DATA |

---

## 2. Test Categories

Unit (pytest) → Integration (pytest + httpx) → Contract (engine interfaces) → E2E (full run with mocks)

---

## 3. 81-Ticker Fixture (Frontend Prototype)

> [v1.3] Cluster 2 prototype — file `prototype/src/mocks/data/stocks-fixture.ts`

Distribution:

| Bucket | Count | Source | Purpose |
|---|---|---|---|
| BĐS thật | 26 | Whitelist VN BĐS sector | Realistic sector view trong charts |
| Mock anchors | 5 | `MOCK_BUY_STRONG/BUY_WARN/HOLD/SELL/INSUFFICIENT` | Predictable test outcomes (xem §1) |
| Fillers | 50 | `MOCK01..MOCK50` (synthetic names + sectors) | Đủ 81 mã cho realistic Treemap density |
| **Total** | **81** | | Match TAD §1 ("~81 mã BĐS") + f01 §UC-01-01 |

Mỗi entry: `{ ticker, name, exchange, sector, seed }`. `seed` (number) dùng cho mulberry32 PRNG (xem §4).

**Anchor invariants** (override PRNG):

| Anchor | ai_score | recommendation | warning_badges |
|---|---|---|---|
| MOCK_BUY_STRONG | 92 | MUA | [] |
| MOCK_BUY_WARN | 78 | MUA | [HIGH_LEVERAGE] (1 badge, -5pp confidence) |
| MOCK_HOLD | 55 | GIỮ | [] |
| MOCK_SELL | 30 | BÁN | [HIGH_LEVERAGE, NEGATIVE_OCF] (2 badges) |
| MOCK_INSUFFICIENT | excluded | — | (excluded round 4: INSUFFICIENT_DATA) |

→ Mỗi run guaranteed có ≥1 ticker mỗi recommendation cluster + 1 excluded → demo data luôn coverage đủ.

---

## 4. Mulberry32 PRNG (Reproducible Mocks)

> [v1.3] KHÔNG dùng `Math.random()` — cluster 2 prototype `prototype/src/mocks/data/run-compute.ts`

```ts
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

**Per-ticker seed:** `master_seed + ticker.seed` → mỗi ticker có random stream riêng nhưng ổn định qua reload.

**Lý do KHÔNG `Math.random()`:**
- Reload 2 lần với cùng `master_seed` → cùng results → screenshot/demo reproducible
- Per-ticker seed → mỗi mã giữ tính chất ổn định, không nhảy
- Test snapshot có thể assert: "MOCK_HOLD ai_score = 55 ± epsilon"

---

## 5. Reason Templates (GUARD-02)

> [v1.3] 13 templates trong `stocks-fixture.ts` — KHÔNG LLM-generate, mỗi template kèm `feature_id`

Per [SRS f06 Explainability Rules](../srs/f06-top-mua-explainability.md): "Lý do KHÔNG ĐƯỢC generate tự do bằng LLM. Mỗi lý do map đến ≥1 scoring feature hoặc risk flag cụ thể."

Cluster 2 enforce qua data layer:

```ts
// stocks-fixture.ts (excerpt)
export const REASON_TEMPLATES = [
  { feature_id: 'F03', text: 'ROE cao ({value}%)' },
  { feature_id: 'F06', text: 'D/E thấp ({value})' },
  { feature_id: 'F08', text: 'Doanh thu tăng {value}%' },
  { feature_id: 'F10', text: 'OCF dương {value} tỷ' },
  { feature_id: 'R04', text: 'Chiết khấu NAV {value}%' },
  { feature_id: 'T01', text: 'Tín hiệu MA tích cực' },
  { feature_id: 'T03', text: 'RSI vùng tăng ({value})' },
  { feature_id: 'T04', text: 'MACD cross-up' },
  { feature_id: 'M01', text: 'Macro: lãi suất giảm' },
  { feature_id: 'S01', text: 'Sentiment tích cực ({value})' },
  // ...13 total
];
```

Run-compute pick 3-5 templates per ticker theo ai_score range, fill `{value}` từ feature value. Cluster 3 (Stock Detail) sẽ reuse cùng templates cho reasons display.

**Test contract:** mỗi `result.reasons[i]` MUST có `feature_id` field non-empty và match enum `F0X|T0X|M0X|R0X|S0X`. Test E2E assert pattern.

---

## 6. MSW Singleton Store Pattern

> [v1.3] Cluster 2 — file `prototype/src/mocks/data/runs-store.ts`

**Vấn đề:** MSW handlers là module re-imported giữa request. Nếu lưu state qua module-level variable, handler request 2 sẽ thấy fresh state (không thấy run từ request 1).

**Fix:** lưu vào `globalThis.__runsStore`:

```ts
// runs-store.ts
type RunsStore = { /* state */ };

declare global {
  // eslint-disable-next-line no-var
  var __runsStore: RunsStore | undefined;
}

function getStore(): RunsStore {
  if (!globalThis.__runsStore) {
    globalThis.__runsStore = createStore();  // seed 3 historical runs
  }
  return globalThis.__runsStore;
}
```

**Lợi:**
- Mọi handler (POST /api/run, GET /api/runs/:id/status, etc.) share cùng store instance trong tab
- Next.js HMR re-import handler module nhưng giữ tab → state run đang chạy không mất

**Caveat:** F5 reload trang → `globalThis` reset → state mất (đây là behavior MSW dev). Backend thật persist qua DB nên không có vấn đề này.
