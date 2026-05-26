# Frontend — VN Real Estate AI Screener

> *Dữ liệu dẫn đường, quyết định thuộc về bạn* — Ngô Minh Tú

Next.js **16** App Router frontend cho VN RE AI Screener. Fork từ [prototype/](../prototype/) ngày 2026-05-09; Phase 9 đã swap MSW → backend FastAPI thực ([mvp/](../mvp/)).

**Status (2026-05-24):** Phase 9 swap MSW→real done; cluster 1-6 UI hoàn chỉnh. Backend đã ship qua Phase 28 + post-Phase deferral closure (macro crawler, PRD §4.5 backtest strict, Turbopack). **Phase 24 đóng Track 1 Security:** Next 14.2.15 → **16.2.6** + next-intl 4.12.0 + eslint 9 + eslint-config-next 16. **Turbopack migration closed:** `npm run dev` / `npm run build` dùng Next 16 default Turbopack, không còn `--webpack`; production build 14 routes pass. **Phase 19 (E2E):** `@playwright/test` + `tests/e2e/smoke.spec.ts` (8-path stateful journey login → refresh → run → dashboard → portfolio → backtest → share → PDF); 8/8 pass. ✅ **Ngrok hand-off blocker cleared.**

---

## 1. Yêu cầu môi trường

- Node 20.9+ (Next 16 yêu cầu — Node 18 không còn support)
- npm 10+ (đi kèm Node 20)
- Backend MVP chạy ở `http://localhost:8000` (xem [mvp/README.md](../mvp/README.md)). Với demo ổn định, backend nên dùng `mvp/code/env.demo.example` + `app.db.demo_seed`.

---

## 2. Setup local

```bash
cd frontend
npm install

# .env.local đã commit sẵn cấu hình real-backend mặc định
# Verify nội dung:
cat .env.local
# NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
# NEXT_PUBLIC_ENABLE_MSW=false

npm run dev
# → http://localhost:3000
# Login: password = ChangeMe123! (mặc định seed)
```

Sau khi login, sẽ vào dashboard. Nếu backend đã chạy `uv run python -m app.db.demo_seed`, DB demo có sẵn `run_demo_latest` nên dashboard/results/top MUA/stock detail có dữ liệu ngay.

---

## 3. Chế độ chạy

Frontend hỗ trợ 2 chế độ qua env var:

| Mode | `.env.local` | Khi dùng |
|---|---|---|
| **Real backend** (mặc định) | `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`<br>`NEXT_PUBLIC_ENABLE_MSW=false` | Phát triển + demo với backend MVP thật |
| **MSW prototype** (offline) | `NEXT_PUBLIC_ENABLE_MSW=true` | Demo offline khi không có backend; data từ fixtures trong `src/mocks/` |

Đổi chế độ: sửa `.env.local` rồi restart `npm run dev`. MSW handlers vẫn được bundle khi build (chỉ kích hoạt khi flag = `true`).

---

## 4. Scripts

```bash
npm install          # install deps
npm run dev          # dev server (next dev / Turbopack), port 3000
npm run build        # next build / Turbopack (TypeScript + route prerender) — 14 routes
npm run start        # production server (sau npm run build)
npm run lint         # next lint
npm run msw:init     # regenerate public/mockServiceWorker.js (1 lần đã sẵn)
npx tsc --noEmit     # type check thuần (không emit)

# E2E (Phase 19)
npm run e2e          # CI=1 npx playwright test (8/8 smoke)
npm run e2e:headed   # visible browser, debug
npm run e2e:ui       # Playwright UI mode (timeline + traces)
npm run e2e:report   # open last HTML report
```

E2E webServer tự bật BE + FE prod build qua `playwright.config.ts`; BE chạy `script/e2e-start-backend.sh` ở mode `APP_ENV=demo` + `VNSTOCK_CLIENT_STUB=true` + `EXPORT_PDF_MODE=html_mock`. Spec: [tests/e2e/smoke.spec.ts](tests/e2e/smoke.spec.ts). Detail: [phase-19 SUMMARY](../mvp/phases/phase-19-playwright-smoke/SUMMARY.md).

---

## 5. Stack

| Package | Vai trò | Notes |
|---|---|---|
| `next` **16.2.6** | App Router + RSC | Single-user, không locale URL prefix. Turbopack default đã pass build; `--webpack` pin removed |
| `react` 18.3.1 + `react-dom` | Core | Client components dùng `'use client'`. React 19 defer (Recharts/lightweight-charts compat) |
| `tailwindcss` | Styling | CSS variables cho 4 theme (TAD g09) |
| `lightweight-charts` 4.2 | Candlestick chart | Stock Detail page (cluster 3) |
| `recharts` 2.13 | Radar / treemap / line / doughnut | Dashboard + Backtest + Risk panels |
| `@tanstack/react-table` | Tables + sorting + filtering | Top MUA, Red Flags, Run History |
| `next-intl` **4.12.0** | i18n VIE/ENG | Default + fallback VIE. v4 client API zero breaking trên codebase hiện tại |
| `lucide-react` | Icons | Lightweight SVG set |
| `msw` | Mock Service Worker | Opt-in fallback cho offline demo |
| `eslint` 9 + `eslint-config-next` 16 | Lint | Peer-dep block trên Next 16 — bump cùng phase |

---

## 6. Layout

```
frontend/src/
├── app/
│   ├── layout.tsx                # Root: Locale + Theme + Auth + Toast providers
│   ├── (auth)/login/             # Public login page
│   ├── (app)/                    # ProtectedRoute group
│   │   ├── layout.tsx            # AppShell (Sidebar + Header + Disclaimer)
│   │   ├── page.tsx              # Dashboard (cluster 2)
│   │   ├── top-mua/              # Top MUA explainability (cluster 2)
│   │   ├── red-flags/            # Excluded + warnings (cluster 2)
│   │   ├── stock-detail/         # Deep-dive 1 mã (cluster 3)
│   │   ├── price-board/          # TTCK live board (cluster 4)
│   │   ├── news/                 # News + sentiment (cluster 4)
│   │   ├── portfolio/            # Holdings CRUD (cluster 5)
│   │   ├── run-history/          # Run list + compare + backtest panel (cluster 5)
│   │   └── settings/             # 5 sections (cluster 6)
│   └── share/[token]/            # PUBLIC share view (no auth)
├── components/                   # Per-feature components (17 dirs)
├── contexts/                     # Auth, Locale, Theme, Toast, Run providers
├── lib/
│   ├── api.ts                    # apiFetch + envelope + 401 redirect
│   ├── stores/                   # runs/portfolio/share/settings singletons
│   ├── types.ts                  # Pydantic schema mirrors
│   └── constants.ts              # storage keys + enums
├── messages/{vi,en}.json         # i18n strings
├── mocks/                        # MSW handlers + fixtures (opt-in)
└── styles/                       # globals + 4 themes
```

---

## 7. Theme & i18n

### Theme
- 4 theme: `classic-dark` (default), `classic-light`, `light`, `oled`
- Áp dụng qua `<html data-theme="...">` + CSS vars
- Flash-of-default-theme tránh bằng `themeBootScript` inline trong `<head>` ([contexts/ThemeContext.tsx](src/contexts/ThemeContext.tsx))
- Stock-market colors: `--ssi-up`, `--ssi-down`, `--ssi-ref`, `--ssi-ceil`, `--ssi-floor` (TTCK 5-color rule cluster 4)

### i18n
- `next-intl` client-side, KHÔNG locale URL prefix
- Default + fallback = `vi`; toggle qua Header dropdown
- Persist `localStorage.locale`
- Missing key → render literal key (regression visible)

---

## 8. Schema source-of-truth

Sau Phase 9, schema canonical = backend ([mvp/code/app/schemas/](../mvp/code/app/schemas/)). FE [`lib/types.ts`](src/lib/types.ts) mirror Pydantic — khi backend đổi shape, FE adapt.

Reconciles đã làm trong Phase 9 + Phase 10 (xem [report/mvp-build/SUMMARY.md §4.A](../report/mvp-build/SUMMARY.md)):
- `reason_text` (excluded list)
- `SharedViewResponse {token, run_id, expires_at, data: {summary, dashboard, top_mua}}`
- `BacktestStatusResponse` không có `progress_percent` / `current_step`
- `BacktestMetrics.roi_curve[].week` (không phải `date`)
- `BacktestResultRow.actual_return_3m` (không có `_pct` suffix, không có `name`)
- `RunResultsResponse {results, total}` — excluded ở endpoint riêng
- `PasswordChangeRequest {current, new_password}` — không phải `current_password`
- `PasswordChangeResponse {token}` — không có `changed: true`

---

## 9. Static reference data

Một số components import constants từ [`src/mocks/data/`](src/mocks/data/) (whitelist 81 mã, warning badge meta, reason codes, feature dict, news source list). Đây là **dictionary thuần — KHÔNG phải network mocks**. Phase 9 §6 đã quyết định giữ as-is; post-MVP có thể move sang `lib/constants/`.

Network-related mocks chỉ active khi `NEXT_PUBLIC_ENABLE_MSW=true`.

---

## 10. Troubleshooting

### FE crash với "Network error" / 401 redirect loop
- Kiểm tra backend đang chạy: `curl http://localhost:8000/api/health` → 200
- Token expired (24h TTL): clear localStorage → login lại
- 401 redirect loop: pathname check trong [lib/api.ts](src/lib/api.ts) skip redirect khi đã ở `/login`

### MSW vẫn intercept dù `NEXT_PUBLIC_ENABLE_MSW=false`
- Restart `npm run dev` (env vars inline lúc build)
- Hard reload browser (Cmd+Shift+R) clear service worker cache
- Verify [public/mockServiceWorker.js](public/mockServiceWorker.js) tồn tại (auto-generated; `npm run msw:init` để regen)

### CORS error trong DevTools
- Backend phải set `FRONTEND_ORIGIN=http://localhost:3000` (mặc định `.env.example`)
- Nếu FE chạy port khác (e.g. 3001): set tương ứng trong backend `.env`
- Preflight OPTIONS phải trả 200 với `access-control-allow-origin`

### "Cannot find module '@/lib/...'"
- TS path alias config trong [tsconfig.json](tsconfig.json)
- Restart `tsserver` trong VSCode (Cmd+Shift+P → "Restart TS Server")

### Build fail vì TypeScript error
```bash
npx tsc --noEmit   # xem full error
npm run lint        # eslint errors
```

### Known security vulns (Phase 18 audit — defer)
`npm audit --production` cho 3 vulns, tất cả qua Next 16 breaking upgrade nên defer sang cycle riêng:

| Package | Severity | Fix |
|---|---|---|
| `next` < 16.3.0-canary.5 | CRITICAL | Upgrade `next@16.2.6` (breaking) |
| `next-intl` ≤ 4.9.1 | MODERATE | Open redirect + prototype pollution. Upgrade `next-intl@4.12.0` (breaking) |
| `postcss` < 8.5.10 | MODERATE | XSS via unescaped `</style>`. Auto-fix qua Next upgrade |

Tham khảo Phase 18 SUMMARY [report/phase-mvp/phase-18-mvp-release-hardening/SUMMARY.md](../report/phase-mvp/phase-18-mvp-release-hardening/SUMMARY.md) §6.

---

## 11. Liên kết

- Backend setup: [mvp/README.md](../mvp/README.md)
- Build history + drift register: [report/mvp-build/SUMMARY.md](../report/mvp-build/SUMMARY.md)
- Phase 9 swap details: [mvp/phases/phase-9-fe-swap/SUMMARY.md](../mvp/phases/phase-9-fe-swap/SUMMARY.md)
- Frozen prototype: [prototype/](../prototype/) (FE reference, KHÔNG develop tiếp)

---

*Cập nhật 2026-05-24 (Phase 24 đóng — Next 14.2.15 → 16.2.6 + next-intl 4.12 + eslint 9; Turbopack default; Playwright 8/8 vẫn pass trên Next 16; ngrok hand-off blocker cleared. Phase 25-28 đóng các polish kèm theo: schema `latest_price`→`latest`, disclaimer banner + InfoBanner dismiss/LocalStorage, bvps fallback + KBS snapshot, useExportPdf binary-safe, PriceBoard placeholder.).*
