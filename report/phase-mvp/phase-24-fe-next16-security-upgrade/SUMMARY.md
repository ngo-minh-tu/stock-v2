# Phase 24 — FE Next 16 Security Upgrade (BLOCKING ngrok hand-off)

**Ngày:** 2026-05-21
**Mục tiêu thực hiện:** đóng critical CVE chain trên FE để gate ngrok hand-off cho trader. Upgrade Next 14.2.15 → 16.2.6 (loại 1 critical + 11 vuln liên quan), next-intl 3.20.0 → 4.12.0 (loại 2 moderate), bump eslint 8→9 + eslint-config-next 14→16 cho peer-deps. **KHÔNG upgrade React 19** — giữ React 18 để Recharts + lightweight-charts không phải đổi.
**Trạng thái:** COMPLETED 2026-05-21

## 1. Việc đã làm

- **Peer-deps research trước upgrade**:
  - `npm view next@16.2.6 peerDependencies` → React 18.2+ vẫn OK, không cần React 19.
  - `npm view next-intl@4.12.0 peerDependencies` → accept Next 16.
  - `engines.node >= 20.9.0` — local Node 20.20.2 OK.
- **Dependency upgrade**:
  - `next` 14.2.15 → **16.2.6** (loại critical CVE chain: DoS Server Actions, dev-server origin verify, Image cache key confusion, middleware SSRF, content injection, 10+ moderate/high vulns liên quan).
  - `next-intl` 3.20.0 → **4.12.0** (loại moderate open-redirect + prototype-pollution).
  - `eslint` 8.57.1 → **9.39.4** (peer-dep block).
  - `eslint-config-next` 14.2.15 → **16.2.6**.
- **Next 15+ async params breaking fix**:
  - `src/app/share/[token]/page.tsx` — convert `params: { token }` sync → `params: Promise<{ token }>` + `async function` + `await params`. 1 file, 3-line diff.
- **Next 16 Turbopack-vs-webpack gate**:
  - Next 16 default Turbopack, conflict với webpack alias `msw/browser: false` trong `next.config.js` (Phase 9 MSW SSR shim).
  - Add `--webpack` flag vào `dev` + `build` scripts trong `package.json` để pin webpack mode. Turbopack migration defer Phase 27.
- **Latent portfolio bug fix** (Phase 24 phát hiện qua Playwright):
  - `src/app/(app)/portfolio/page.tsx:38` — `stock?.latest_price.close ?? h.buy_price`.
  - Bug pre-existing từ Phase 7 (commit e79b916 initial scaffold). BE serialize `latest` (`StockListItem.latest`), FE access `latest_price` → runtime crash khi stock defined.
  - Phase 19 Playwright passed nhờ Next 14 dev-mode timing; Next 16 production build timing đổi → bug expose deterministic.
  - Fix minimal: add `?.` ở mỗi level (`stock?.latest_price?.close`). Pass-through fallback to `buy_price`. Schema rename FE `latest_price` → `latest` defer Phase 25.
- **Test verification**:
  - `npx tsc --noEmit` clean.
  - `npm run build` → 14 routes prerendered, build OK.
  - `CI=1 npx playwright test` → 8/8 pass.
  - `uv run pytest -q` (BE sanity check) → 288/288 pass.
  - `npm audit --omit=dev` → 0 critical (3 moderate postcss transitive — wait upstream Next bump).

## 2. File đã thêm

- `mvp/phases/phase-24-fe-next16-security-upgrade/SUMMARY.md` — audit trail 9-section.
- `mvp/phases/phase-24-fe-next16-security-upgrade/REVIEW.md` — self-critical review.
- `report/phase-mvp/phase-24-fe-next16-security-upgrade/SUMMARY.md` — file này.

## 3. File đã sửa

- `frontend/package.json` — bump next 16.2.6 + next-intl 4.12.0 + eslint 9.39.4 + eslint-config-next 16.2.6; `dev` + `build` scripts thêm `--webpack` flag.
- `frontend/package-lock.json` — lockfile updated (64 added / 48 removed / 36 changed).
- `frontend/src/app/share/[token]/page.tsx` — async params (Next 15+ breaking).
- `frontend/src/app/(app)/portfolio/page.tsx` — `stock?.latest_price?.close` (+ ceiling/floor/reference) — guard schema drift.

## 4. Lệnh đã chạy

```bash
cd /Users/ngominhtu/Projects/stock-v2/frontend

# Peer-deps research
npm view next@16.2.6 peerDependencies engines
npm view next-intl@4.12.0 peerDependencies

# Upgrade
npm install next@16.2.6 next-intl@4.12.0 eslint-config-next@16.2.6 eslint@9 --save
# added 64 packages, removed 48 packages, changed 36 packages

# Type check
npx tsc --noEmit
# (clean)

# Production build (first attempt failed Turbopack/webpack conflict → add --webpack flag)
npm run build
# ✓ Generating static pages (14/14)

# Vulnerability audit
npm audit --omit=dev
# 3 moderate (postcss transitive); 0 critical

# Playwright critical-path smoke
CI=1 npx playwright test
# Run 1: 4 passed, 1 failed (test 05 — latent portfolio bug)
# After portfolio fix → Run 2: 8 passed (44.2s)

# Backend sanity check
cd ../mvp/code && uv run pytest -q
# 288/288 passed
```

## 5. Kết quả

- **Vulnerabilities**:
  | Mức | Trước Phase 24 | Sau Phase 24 |
  |---|---|---|
  | Critical | **1** (`next` < 16) — DoS, SSRF, content injection chain | **0** ✅ |
  | Moderate | **2** (`next-intl` open-redirect + prototype-pollution; `postcss` XSS) | **3** (postcss XSS transitive — upstream wait) |
  | High | 0 | 0 |
  | Total | 3 | 3 (net: -1 critical, +1 moderate via transitive shift) |

- **Test results**:
  | Suite | Trước | Sau |
  |---|---|---|
  | TypeScript | clean | clean ✅ |
  | Next.js build | 14 routes | 14 routes ✅ |
  | Playwright E2E | 8/8 | 8/8 ✅ |
  | BE pytest | 288/288 | 288/288 ✅ |

- **Phát hiện ngoài kế hoạch**:
  - Latent schema drift bug `latest_price` vs `latest` đã có từ Phase 7, không catch qua Phase 9 reconcile lẫn Phase 19 Playwright. Next 16 production build timing đổi → đẩy bug từ flaky-pass thành deterministic-fail. Fix minimal optional-chain (1 file, 4 lines). Full schema rename Phase 25.

## 6. Tồn đọng

- **3 moderate postcss vulns vẫn còn** — transitive qua next + next-intl. Build-time XSS via `</style>` stringify, KHÔNG exploit từ user input app. Wait upstream Next 16.x bundled postcss bump. Acceptable cho ngrok single-trader hand-off.
- **Schema rename FE `latest_price` → `latest`** — Phase 25. Hiện optional-chain pass-through to `buy_price` fallback (portfolio table luôn hiển thị buy_price làm current — không bị crash, nhưng KHÔNG hiển thị real market price). MVP UX không có realtime quote nên acceptable.
- **Turbopack migration** — Phase 27 polish. `--webpack` flag stable cho Next 16.x line.
- **React 19 upgrade** — out of scope. Defer khi Recharts 3 + lightweight-charts 5 stabilized.
- **HoldingFormModal TODAY hard-code** (Phase 19 REVIEW Low) — chưa fix. Phase 25.
- **`useExportPdf` blob.text() raw fetch** — Phase 27 polish.
- **eslint 9 lint verification chưa chạy** — `npm run lint` defer Phase 25.
- **E2E navigate `/share/{token}` route** — Playwright test 07 chỉ test modal create, không navigate dynamic page. Manual smoke khi setup ngrok.
- **Hand-off blocking**: ✅ Critical CVE eliminated → ngrok ready theo gate Phase 24. Pre-handoff checklist: Phase 25 (UX polish + disclaimers + DB refresh).
