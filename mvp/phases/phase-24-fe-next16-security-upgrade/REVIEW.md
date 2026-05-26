# Phase 24 — FE Next 16 Security Upgrade REVIEW

**Started:** 2026-05-21
**Completed:** 2026-05-21
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Trọng tâm review: Phase 24 đóng critical CVE chain — gate cho ngrok hand-off. Câu hỏi chính: upgrade có thực sự loại critical không, có regression nào lộ thêm chưa, và Turbopack defer + schema-drift band-aid có tạo bệnh tiềm ẩn cho Phase 25+ không?

## Findings

- **High — Schema drift `latest_price` vs `latest` chưa fix root cause.** [portfolio/page.tsx:38-41](../../../frontend/src/app/(app)/portfolio/page.tsx#L38) hiện `stock?.latest_price?.close ?? h.buy_price` — TypeScript thấy `latest_price` (per `StockListItem` interface), runtime `stock.latest_price` luôn `undefined` vì BE serialize `latest` (`StockListItem.latest`). Optional chaining pass-through fallback to `buy_price` → portfolio table giờ luôn hiển thị `buy_price` làm `current_price` (visually OK vì equal khi mới add, nhưng nếu giá market đổi sẽ KHÔNG hiển thị). Phase 7 reconcile miss. Phase 25 phải rename FE `latest_price` → `latest` (4 lines + types.ts). Hiện acceptable vì portfolio MVP UX không có realtime quote.

- **High — Next 16 production build timing change đã lộ pre-existing bug.** Bug đã có từ Phase 7 (commit e79b916, initial scaffold), KHÔNG ai catch qua Phase 9 reconcile cũng như Phase 19 Playwright (8/8 pass at the time). Render timing thay đổi giữa Next 14 dev → Next 16 production → từ flaky-pass thành deterministic-fail. Bài học: production-mode E2E sớm hơn (Phase 19 đã làm — vẫn miss). Cần thêm assertion explicit: `expect(stockMap.get(...)?.latest).toBeDefined()` hoặc unit test cho rows useMemo. Phase 25 schema rename sẽ tự nhiên đóng.

- **High — 3 moderate postcss vulns vẫn còn sau upgrade.** `npm audit --omit=dev`: postcss < 8.5.10 transitive qua next + next-intl. Fix path qua `npm audit fix --force` sẽ revert next 9.x (catastrophic). Upstream Next 16.x cần bump bundled postcss. Build-time XSS via `</style>` stringify — KHÔNG exploit từ user input app (chúng ta không accept arbitrary CSS). Acceptable cho ngrok single-trader hand-off. Operator track upstream Next release notes; nếu CVSS upgrade lên high, force-fix.

- **Medium — Turbopack migration defer tạo "dual-mode" risk.** [package.json](../../../frontend/package.json) hiện `next dev --webpack` + `next build --webpack`. Next 16 official direction là Turbopack default. Nếu future PR (hoặc dev local) quên `--webpack` flag, sẽ fail với Turbopack alias error. Mitigation: documentation trong SUMMARY § + REVIEW. Permanent fix: Phase 27 convert webpack alias sang Turbopack config hoặc bỏ MSW SSR shim (test MSW gating production behavior).

- **Medium — React 18 stay decision: timing-sensitive.** Next 16 vẫn accept React 18.2+, nhưng các Next 17/18 future major có thể require React 19. Recharts 3 (released 2026 Q1) + lightweight-charts 5 đã support React 19 (lib changelog confirms). Nghĩa là khả năng compat sẵn, chỉ là rủi ro upgrade-storm sau này. Phase 24 chọn minimal-touch hợp lý cho gate ngrok.

- **Medium — eslint 9 bump không có verification.** `package.json` bump eslint 8.57.1 → 9.39.4 vì peer-dep block. `next lint` chưa chạy trong Phase 24 verify. Nếu eslint 9 flat-config có rules-set khác, `npm run lint` có thể spam warning hoặc fail. Defer kiểm Phase 25.

- **Medium — Latent bug investigation thiếu unit guard.** Phase 24 phát hiện schema drift qua Playwright trace; nhưng nếu drift chỉ visible khi user thực sự add holding sau refresh empty state, thì các test suite khác (test-portfolio nếu có) cũng miss. Đề xuất Phase 25 thêm vitest test cho portfolio rows useMemo: assert mapping behavior khi `latest` null vs populated.

- **Low — `package.json` script edit dùng `--webpack` không phải `--turbo`-fallback flag style.** Next 16 chấp nhận cả `--webpack` (explicit) và việc set `turbopack: false` trong next.config (config-level). Script-level explicit flag dễ debug hơn, nhưng nếu user clone repo và chạy `npx next dev` trực tiếp (không qua npm script), sẽ fail. Mitigation: SUMMARY.md document; or move opt-out vào config. Defer.

- **Low — `share/[token]/page.tsx` async params rewrite không có Playwright test riêng.** Test 07 (Share link modal) chỉ test CREATE share + GET token, không navigate tới `/share/{token}` route. Page rerender qua dynamic route. Phase 24 build pass + Next prerender báo `ƒ /share/[token]` dynamic OK; nhưng chưa có E2E navigate-and-render assert. Operator manual smoke test khi setup ngrok.

## Đã kiểm chứng

- Đã đọc [PLAN.md §7](../../../plan/PLAN.md) + [memory project_phase24_plus_roadmap](file:///Users/ngominhtu/.claude/projects/-Users-ngominhtu-Projects-stock-v2/memory/project_phase24_plus_roadmap.md) cho scope locked.
- Đã peer-deps research: `npm view next@16.2.6 peerDependencies` xác nhận React 18.2+ OK; `engines.node >= 20.9.0` OK (local 20.20.2).
- Đã build + tsc verify clean.
- Đã Playwright re-run 2 lần (lần 1: 4 passed, 1 failed test 05; lần 2 sau portfolio fix: **8 passed**).
- Đã BE pytest 288/288 vẫn pass (FE upgrade không đụng BE — confirm sanity).
- Đã grep + trace-zip extract verify bug root cause (chunk `page-76fc667b2043ba84.js` offset 14910 = minified `a?.latest_price.close ?? e.buy_price`).
- Vulnerabilities verify:
  - **Before**: 1 critical (next) + 2 moderate (next-intl + postcss).
  - **After**: 0 critical + 3 moderate (postcss transitive — upstream wait).
- Đã verify Next 16 prerender 14 routes static + 1 dynamic (share/[token]).

```bash
cd /Users/ngominhtu/Projects/stock-v2/frontend
npx tsc --noEmit          # clean
npm run build              # 14 routes prerendered
npm audit --omit=dev       # 3 moderate (postcss); 0 critical
CI=1 npx playwright test   # 8 passed (44.2s)

cd ../mvp/code
uv run pytest -q           # 288/288 passed
```

## Điểm làm tốt

- Peer-deps research TRƯỚC khi `npm install` — phát hiện Next 16 vẫn accept React 18 → tránh chain-reaction upgrade Recharts/lightweight-charts.
- Phát hiện Turbopack-vs-webpack conflict ở build-time đầu tiên, fix bằng `--webpack` flag minimal — KHÔNG go down rabbit hole convert config sang Turbopack syntax.
- Async params fix narrow + correct (1 file change, 3 lines diff). KHÔNG over-engineer.
- Playwright failure investigation systematic: error context md → screenshot → unzip trace → page-error message → minified chunk inspection → grep source. Mỗi step thu hẹp scope.
- Portfolio bug fix minimal optional-chain — KHÔNG rename schema (out-of-scope). Document drift trong SUMMARY §6 + REVIEW High finding cho Phase 25.
- BE pytest sanity check confirm FE upgrade không leak vào BE (orthogonal check).
- Memory + roadmap đọc trước (project_phase24_plus_roadmap) → scope đúng theo locked decision.

## Cần revisit

- **Phase 25 §1 (proposed)**: FE schema rename `latest_price` → `latest` toàn codebase (4 lines portfolio/page.tsx + 1 line types.ts). Đồng bộ với BE truth `StockListItem.latest`. Verify Playwright after rename.
- **Phase 25 unit test** cho portfolio rows useMemo — assert null-latest fallback + populated-latest mapping.
- **Phase 27 Turbopack migration**: convert webpack alias sang Turbopack config OR audit MSW SSR shim necessity (Phase 9 MSW gating via `NEXT_PUBLIC_ENABLE_MSW=true` → SSR shim chỉ cần khi env var set; production env không set, có thể drop alias).
- **`npm run lint` verify** dưới eslint 9 — chạy ít nhất 1 lần đảm bảo no breakage.
- **Track upstream Next 16.x postcss bump** — monitor `npm audit` sau mỗi `next` patch.
- **E2E navigate `/share/{token}`** — add explicit goto assert trong Playwright test 07.
- **React 19 upgrade window**: planning sau khi Recharts 3 + lightweight-charts 5 stabilized 6 months ở production ecosystem.

## Post-phase findings

- **2026-05-22 — Recharts 2.13 `ResponsiveContainer` broken dưới Next 16 webpack.** Same class as Phase 19 findings: production bug câm, tsc + pytest 288/288 + Playwright 8/8 ĐỀU pass nhưng dashboard 5 charts render trống. User catch qua manual smoke. Fix bằng custom `ResponsiveChart` wrapper (33 dòng) replace 8 chỗ `<ResponsiveContainer>`. Detail trong [SUMMARY.md §9](./SUMMARY.md#9-post-phase-fixes). Self-critic: REVIEW Medium-line "Recharts 2.x stay decision" (line 19) chỉ assess compat-on-paper, không assert chart SVG render. Playwright critical-path smoke 8/8 không cover chart visibility — hỏng chỗ cao nhất. Phase 25+ phải thêm `expect(page.locator('svg.recharts-surface').count()).toBeGreaterThan(0)` cho mọi route chart.
