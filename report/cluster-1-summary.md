# Cluster 1 Summary — Shell & Foundation

## 1. Metadata

- **Cluster:** 1 — Shell & Foundation
- **Khoảng ngày:** 2026-05-06 (1 ngày, 1 commit)
- **Commit kết thúc:** [`4718c95`](../../commit/4718c95) `feat(prototype): cluster 1 — shell & foundation`
- **Prompt:** [prompts/cluster-1-shell-foundation.md](../prompts/cluster-1-shell-foundation.md)
- **README:** [prototype/README.md](../prototype/README.md)

## 2. Phạm vi

**Dự kiến (theo prompt):** auth flow, AppShell (sidebar+header+disclaimer), 4 theme + switcher, i18n VIE/ENG, Settings (theme+language), MSW 6 endpoints, 8 placeholder pages.

**Thực tế làm:** đầy đủ scope dự kiến, không cắt mục lớn nào.

**Hoãn có chủ ý** (đúng prompt §1, §13):
- AG-Grid / Highcharts: không dùng (TAD §2 chốt khác — TanStack Table + Recharts vào cụm 2; Lightweight Charts vào cụm 3).
- Settings sections sources / telegram / threshold / password → placeholder cho cụm 6.
- 8 placeholder pages khác (Top MUA, Red Flags, Stock Detail, Price Board, News, Portfolio, Run History, Dashboard) → `<ComingSoon clusterNumber={N} />`.

## 3. File mới (prototype/src — tất cả đều mới do là cụm đầu)

### App Router (pages)
- [src/app/layout.tsx](../prototype/src/app/layout.tsx) — root: provider stack MSW → Locale → Theme → Auth + Roboto font
- [src/app/(auth)/login/page.tsx](../prototype/src/app/(auth)/login/page.tsx) — login route (chỉ render `<LoginForm />`)
- [src/app/(app)/layout.tsx](../prototype/src/app/(app)/layout.tsx) — wrap `(app)` group bằng `<ProtectedRoute>` + `<AppShell>`
- [src/app/(app)/page.tsx](../prototype/src/app/(app)/page.tsx) — Dashboard placeholder (cluster 2)
- [src/app/(app)/top-mua/page.tsx](../prototype/src/app/(app)/top-mua/page.tsx) — placeholder cluster 2
- [src/app/(app)/red-flags/page.tsx](../prototype/src/app/(app)/red-flags/page.tsx) — placeholder cluster 2
- [src/app/(app)/stock-detail/page.tsx](../prototype/src/app/(app)/stock-detail/page.tsx) — placeholder cluster 3
- [src/app/(app)/price-board/page.tsx](../prototype/src/app/(app)/price-board/page.tsx) — placeholder cluster 4
- [src/app/(app)/news/page.tsx](../prototype/src/app/(app)/news/page.tsx) — placeholder cluster 4
- [src/app/(app)/portfolio/page.tsx](../prototype/src/app/(app)/portfolio/page.tsx) — placeholder cluster 5
- [src/app/(app)/run-history/page.tsx](../prototype/src/app/(app)/run-history/page.tsx) — placeholder cluster 5
- [src/app/(app)/settings/page.tsx](../prototype/src/app/(app)/settings/page.tsx) — Settings thật: 2 sections (theme + language)

### Components
- **layout/**
  - [AppShell.tsx](../prototype/src/components/layout/AppShell.tsx) — grid sidebar + header + main + disclaimer
  - [Sidebar.tsx](../prototype/src/components/layout/Sidebar.tsx) — 9 menu items, active highlight crimson, responsive 240/64/drawer
  - [Header.tsx](../prototype/src/components/layout/Header.tsx) — brand + theme dropdown + locale toggle + logout
  - [Disclaimer.tsx](../prototype/src/components/layout/Disclaimer.tsx) — footer text PRD §14, hiển thị mọi page
- **auth/**
  - [LoginForm.tsx](../prototype/src/components/auth/LoginForm.tsx) — single-password form, gọi `POST /api/auth/login`
  - [ProtectedRoute.tsx](../prototype/src/components/auth/ProtectedRoute.tsx) — guard `(app)`, redirect `/login` nếu không token
- **settings/**
  - [ThemePicker.tsx](../prototype/src/components/settings/ThemePicker.tsx) — 4 radio cards, apply ngay + persist + PUT fire-and-forget
  - [LanguagePicker.tsx](../prototype/src/components/settings/LanguagePicker.tsx) — VIE/ENG radio
- **common/**
  - [Button.tsx](../prototype/src/components/common/Button.tsx), [Input.tsx](../prototype/src/components/common/Input.tsx), [Select.tsx](../prototype/src/components/common/Select.tsx) — primitives theme-aware
  - [ComingSoon.tsx](../prototype/src/components/common/ComingSoon.tsx) — placeholder text "sẽ có trong Cluster N"
  - [MswBootstrap.tsx](../prototype/src/components/common/MswBootstrap.tsx) — start MSW worker chỉ ở dev, gate render con cho tới khi ready

### Contexts (state)
- [AuthContext.tsx](../prototype/src/contexts/AuthContext.tsx) — token state + login/logout, đọc/ghi `localStorage.token`
- [ThemeContext.tsx](../prototype/src/contexts/ThemeContext.tsx) — theme state + `themeBootScript` inline `<head>` chống flash
- [LocaleContext.tsx](../prototype/src/contexts/LocaleContext.tsx) — bridge next-intl (`NextIntlClientProvider`) + persist `localStorage.locale`

### Lib
- [lib/api.ts](../prototype/src/lib/api.ts) — `apiFetch<T>` wrapper: Bearer auto, parse envelope, 401 logout, `JobConflictError` cho cụm 2
- [lib/constants.ts](../prototype/src/lib/constants.ts) — enums (RunStatus, Theme, Locale), STORAGE_KEYS, MOCK_JWT_PREFIX
- [lib/types.ts](../prototype/src/lib/types.ts) — envelope `ApiSuccess`/`ApiError`, response shapes (Login, Health, Settings, Version)

### MSW mocks
- [mocks/handlers.ts](../prototype/src/mocks/handlers.ts) — 6 handlers + catch-all `/api/*` trả 404 envelope
- [mocks/data/settings.ts](../prototype/src/mocks/data/settings.ts) — default settings + `getSettings`/`patchSettings`
- [mocks/data/version.ts](../prototype/src/mocks/data/version.ts) — payload theo TAD g02 §3

### i18n
- [messages/vi.json](../prototype/src/messages/vi.json) — VIE keys (auth, nav, settings, common.disclaimer, common.placeholder.cluster2..5)
- [messages/en.json](../prototype/src/messages/en.json) — ENG mirror

### Styles
- [styles/globals.css](../prototype/src/styles/globals.css) — Tailwind base + utilities + reset
- [styles/themes.css](../prototype/src/styles/themes.css) — 4 theme blocks (`[data-theme="..."]`) + SSI stock colors `--ssi-up/down/ref/ceil/floor/stable` cho mỗi theme

### Config
- [tailwind.config.ts](../prototype/tailwind.config.ts), [next.config.js](../prototype/next.config.js), [tsconfig.json](../prototype/tsconfig.json), [.eslintrc.json](../prototype/.eslintrc.json), [postcss.config.js](../prototype/postcss.config.js), [package.json](../prototype/package.json)
- [public/mockServiceWorker.js](../prototype/public/mockServiceWorker.js) — generate bằng `npm run msw:init`

### Docs / prompts (commit chung trong cụm 1)
- Commit cũng đưa vào toàn bộ `docs/PRD_v0.5A_Final_Locked.md`, `docs/design.md`, `srs/*` (f01–f17 + g01–g04 + 00-overview), `tad/*` (00 + g01–g08 + c01–c09), và 6 prompt cluster. Đây là tài liệu pre-existing, commit cùng code để source-of-truth + code đi cùng nhau từ đầu.

## 4. File sửa

Không xác định được — cụm 1 là initial commit, không có "trước đó" để so sánh.

## 5. Refactor / nâng cấp

Không. Cụm 1 setup base, không refactor cái có sẵn.

## 6. Quyết định kỹ thuật

- **`classic-light` tự derive** (design.md không định nghĩa): lấy surface + text từ `theme-light`, giữ accent crimson + buy/sell. Lý do: PRD §8.2 chốt "Classic có 2 chế độ Sáng/Tối" nhưng design chỉ có 3 theme.
- **Lucide React làm icon set**: TAD §2 chưa chốt; chọn Lucide để các cụm sau theo. Lý do: Tree-shake tốt, theme-aware qua `currentColor`.
- **Theme boot script inline trong `<head>`** (`themeBootScript` từ ThemeContext): set `data-theme` từ `localStorage` trước khi React mount. Lý do: chống flash-of-default-theme khi reload trên dark mode.
- **Provider stack order: MSW → Locale → Theme → Auth** (từ ngoài vào trong, theo README §4). Lý do: MSW phải start trước khi Auth gọi `/api/auth/*`; Theme độc lập với Auth nhưng cần Locale ready để hiển thị label theme đúng ngôn ngữ.
- **`localStorage` thay vì cookie** cho token/theme/locale: single-user MVP, không cần SSR session, không cần URL locale prefix (PRD nhấn mạnh single-user).
- **`JobConflictError` được tạo sẵn ở cụm 1** dù không endpoint nào throw 409. Lý do: cụm 2 (POST /api/run) sẽ dùng — set up tại biên `apiFetch` để cụm sau chỉ catch.
- **Catch-all `/api/*` trả 404 envelope** thay vì pass-through MSW. Lý do: phát hiện sớm endpoint chưa mock với message Vietnamese rõ ràng "chưa implement, cụm sau làm".
- **Stock market colors `--ssi-*` khai báo sẵn trong cả 4 theme** dù cụm 1 không dùng. Lý do: cụm 2-3 (Dashboard charts, Price Board) chỉ cần read variable, không cần đợi setup theme thêm.
- **Single commit cho cả cụm**: theo prompt §12. Lý do: gọn, atomic, dễ revert nguyên cụm nếu sai scope.

## 7. Dependencies

**Thêm mới (deps):**
- `next@14.2.15`, `react@18.3.1`, `react-dom@18.3.1` — framework + runtime
- `next-intl@3.20.0` — i18n (TAD §2)
- `lucide-react@0.452.0` — icons (quyết định cụm này, TAD chưa chốt)

**Thêm mới (devDeps):**
- `msw@2.4.9` — mock API
- `tailwindcss@3.4.13`, `postcss@8.4.47`, `autoprefixer@10.4.20` — styling
- `typescript@5.6.3`, `@types/{node,react,react-dom}` — TS strict
- `eslint@8.57.1`, `eslint-config-next@14.2.15` — linting

**Bỏ / upgrade:** không có (lần đầu init).

**Không thêm dù prompt có ám chỉ:** AG-Grid, Highcharts (TAD §2 chốt khác); TanStack Table + Recharts + Lightweight Charts (cụm sau).

## 8. Mock data

Shape & file nguồn cho cụm sau tham khảo:

- **Settings** ([mocks/data/settings.ts](../prototype/src/mocks/data/settings.ts)): default theme=CLASSIC, classic_mode=DARK, language=VIE, plus thresholds + sources placeholder. `getSettings()` / `patchSettings(patch)` mutate in-memory + bump `settings_version`.
- **Version** ([mocks/data/version.ts](../prototype/src/mocks/data/version.ts)): theo TAD g02 §3 — backend version, data version, build time.
- **Auth/login**: token sinh `MOCK_JWT_PREFIX + Date.now()` ngay trong handler, không lưu store.

Không có run/stock/dashboard fixture ở cụm 1 — cụm 2 sẽ thêm ([mocks/data/runs-store.ts](../prototype/src/mocks/data/runs-store.ts) etc.).

## 9. Nợ kỹ thuật / TODO

- **Settings sections "Coming in cluster 6"** trong UI (sources / telegram / threshold / password) — chưa render ngay cả placeholder text trong code cụm 1. Cụm 6 cần thêm section blocks.
- **`mocks/browser.ts` riêng** (như prompt §3 gợi ý) không tách — logic start worker nằm trong `MswBootstrap.tsx`. Nếu cụm sau cần worker từ ngữ cảnh khác (e.g. SSR test), tách ra.
- **Tablet/mobile sidebar drawer** chưa có verification trên thiết bị thật — chỉ test viewport CSS.
- **Acceptance criteria #9 (4 themes contrast)** dựa vào trực quan, chưa có a11y test tự động (nợ cụm sau hoặc cụm 6).
- **`PUT /api/auth/password`** mock có nhưng UI gọi chưa có (Settings cluster 6 sẽ wire).

## 10. Ảnh hưởng cluster sau

- **Cluster 2 (Screening Flow):**
  - Fill 3 placeholder pages: Dashboard `/`, Top MUA `/top-mua`, Red Flags `/red-flags`.
  - Dùng `apiFetch` + `JobConflictError` đã có cho `POST /api/run` 409.
  - Thêm MSW handlers vào `mocks/handlers.ts` (catch-all sẽ cover những gì chưa mock).
  - Thêm i18n keys vào cả 2 file `messages/{vi,en}.json` (convention đã set).
  - Dùng `--ssi-*` colors trực tiếp cho charts + Treemap.
  - Header có sẵn slot bên trái cho `RunButton` (theo prompt cụm 2 §3.1).
- **Cluster 3 (Stock Detail):** fill `/stock-detail` placeholder, dùng cùng AppShell.
- **Cluster 4 (Market & Browse):** `/price-board`, `/news` — dùng `--ssi-up/down/ceil/floor/ref` cho price board.
- **Cluster 5 (Personal & History):** `/portfolio`, `/run-history`.
- **Cluster 6 (Export & Integrations):** mở rộng Settings page — thêm sources/telegram/threshold/password sections song song 2 section đã có.

## 11. Test thủ công

| Bước | URL / Action | Kỳ vọng |
|---|---|---|
| 1 | `cd prototype && npm install && npm run dev` → `http://localhost:3000` | Console log "Mocking enabled", redirect `/login` |
| 2 | Login với password bất kỳ | Redirect `/`, sidebar 9 items + header hiển thị |
| 3 | Click 8 menu non-Settings | Render `<ComingSoon />` với cluster number đúng (Dashboard/TopMUA/RedFlags=2, StockDetail=3, PriceBoard/News=4, Portfolio/RunHistory=5) |
| 4 | `/settings` → đổi theme dropdown 4 lần | UI đổi ngay với cả 4 theme; F5 giữ state |
| 5 | `/settings` → toggle VIE↔ENG | Text đổi ngay (sidebar, header, disclaimer); F5 giữ state |
| 6 | Header logout icon | Clear token, redirect `/login`; thử quay lại `/` → bật lại login page |
| 7 | Footer disclaimer | Hiển thị mọi page sau login (PRD §14 text) |
| 8 | Resize: desktop / tablet / mobile | Sidebar full 240px / collapse 64px / drawer hamburger |
| 9 | DevTools Network | `GET /api/version`, `/api/health`, `/api/settings` trả envelope `{success:true, data:...}` |
| 10 | Gọi tay `fetch('/api/runs')` trong console | Trả 404 với envelope `NOT_IMPLEMENTED` (catch-all) |
| 11 | `npm run build && npm run lint` | Pass cả TypeScript strict + ESLint, 13 routes |

## 12. Post-cluster fixes

### Fix #1 — Classic Light theme thiếu nhận diện riêng (2026-05-08)

**Triệu chứng:** User code-review chỉ ra `classic-light` và `light` gần như identical về CSS variables — chỉ khác 3 biến (`--color-theme-charcoal`, `--color-theme-text-secondary`, `--color-theme-text-explain`). Tất cả surfaces, inputs, tables, cards giống hệt nhau. Khi user toggle Sáng/Tối trong Classic theme, hiệu ứng visual gần như không thấy được — defeat the purpose của 4-theme design (PRD §8.2).

**Root cause:** Comment header trong `themes.css` ghi "classic-light is derived: surfaces from theme-light, accent crimson + buy/sell preserved" — nhưng Light theme **cũng đã có crimson** (`--color-theme-text-highlight: #d32f2f`), nên ý đồ giữ "accent Classic" trong light mode không có effect. Design original chưa thiết kế palette riêng cho classic-light, chỉ copy từ light.

**Fix:**
1. `prototype/src/styles/themes.css` — viết lại 21 hex values trong block `[data-theme='classic-light']`, áp tint tím nhẹ (hue ~250°, lấy từ classic-dark family invert lightness):
   - Surfaces: `#ededed` → `#ecebef`, `#ffffff` → `#faf9fc`, `#f4f4f4` → `#f1f0f4`, ...
   - Borders: `#cfd2d8` → `#c8c5d2`, `#dfe1e6` → `#d8d5e0`
   - Text colors **giữ nguyên** (readability đã OK)
   - Crimson/buy/sell **giữ nguyên** (SSI brand)
   - SSI TTCK colors **giữ nguyên** Light variant (AC-17-03)
2. `docs/design.md` — bổ sung §4.4 "Classic Light (Toggle Sáng cho Classic Theme)" giải thích intent + đầy đủ palette + so sánh với §4.2.
3. Comment header trong themes.css cập nhật: "Classic identity in light mode: subtle purple tint on surfaces (hue ~250°, inherited from classic-dark family) + crimson accent preserved. Distinct from `light` (pure neutral grays)."

**Tác dụng phụ:** Chỉ user dùng theme `classic-light` mới thấy đổi. 3 themes còn lại (`classic-dark`, `light`, `oled`) không bị động.

**Iteration 2 (cùng ngày, sau user feedback):** Iteration 1 dùng tint quá nhẹ (ΔE 1-3, R≈B≈G gần neutral) → user thấy giống y hệt theme Light. Bump mạnh hơn theo công thức **R = B > G rõ rệt** (hue shift từ ~250° sang ~270° lavender thực sự), ΔE 5-10 cho hầu hết tokens, riêng `--color-theme-charcoal` (border) ΔE ~10 — biến thấy rõ nhất bằng mắt thường:
- Surfaces: `#ecebef` → `#ece9f0`, `#faf9fc` → `#f7f4fb`, `#f1f0f4` → `#eeeaf4`
- Borders: `#c8c5d2` → `#b7b2c8`, `#d8d5e0` → `#d0c7dc`
- Onyx/highlight/invert: bump tương ứng để giữ hierarchy
File touched (iter 2): `prototype/src/styles/themes.css`, `docs/design.md` (cập nhật §4.4 spec).

**Iteration 3 (cùng ngày, sau user feedback):** User feedback "ánh tím hơi tối" → đổi hue family từ purple (~270°, R = B > G) sang cool blue (~210°, B > R = G). Cùng độ sáng (L* tương đương) nhưng cảm giác **tươi sáng hơn**, đồng thời gần với hue dominant của classic-dark hơn (B=41 > R=28 > G=26 ở `#1c1a29`). Giữ ΔE ~5-10 cho phần lớn tokens, đặc biệt borders ΔE ~10:
- Surfaces: `#ece9f0` → `#e9ecf0`, `#f7f4fb` → `#f4f7fb`, `#eeeaf4` → `#eaeef4`
- Borders: `#b7b2c8` → `#b2bcc8`, `#d0c7dc` → `#c7d2dc`
- Công thức: R và G của bản purple swap với nhau → ra blue tint (kênh B vẫn cao nhất)
File touched (iter 3): `prototype/src/styles/themes.css`, `docs/design.md` (§4.4 update sang cool-blue spec).

**Iteration 4 (cùng ngày, sau user feedback):** User feedback "xanh hơi nhạt" → tăng saturation, giữ hue ~215°. Tăng B-R gap từ ~7-10 lên ~15-20 units cho hầu hết surface tokens, borders ΔE ~8 thêm. Brightness gần như giữ nguyên (chỉ giảm ~3-5 trên L*) để không thành dark tone:
- Surfaces: `#e9ecf0` → `#e3e9f2`, `#f4f7fb` → `#eff4fc`, `#eaeef4` → `#e5ecf5`
- Borders: `#b2bcc8` → `#a3b3c6`, `#c7d2dc` → `#b8c7da`
- Onyx (rows): `#d9deeb` → `#cfdaeb`
File touched (iter 4): `prototype/src/styles/themes.css`, `docs/design.md` (§4.4 saturation spec).

**File touched:** `prototype/src/styles/themes.css`, `docs/design.md`.

### Fix #2 — Tooltip 2 chart Tổng quan "trôi" theo cursor có độ trễ (2026-05-08)

**Triệu chứng:** Trên Dashboard Tổng quan, hover vào chart "Xu hướng VN-Index & ngành BĐS" (LineChart) hoặc "Top 10 mã theo AI Score" (BarChart), tooltip không bám đúng vị trí cursor mà trượt/lag rõ rệt khi di chuyển giữa các điểm dữ liệu — gây cảm giác "thông tin đi lung tung". Recharts mặc định bật animation transition trên tooltip wrapper.

**Root cause:** Recharts `<Tooltip>` mặc định `isAnimationActive=true` + có CSS `transition` trên wrapperStyle, nên mỗi lần cursor đổi điểm dữ liệu, tooltip animate position trong ~400ms thay vì snap ngay.

**Fix:**
1. `prototype/src/components/charts/LineChart.tsx` — thêm `isAnimationActive={false}`, `animationDuration={0}`, `contentStyle.transition: 'none'`, `wrapperStyle={{ transition: 'none', pointerEvents: 'none' }}`.
2. `prototype/src/components/charts/BarChart.tsx` — apply cùng pattern.

**Tác dụng phụ:** Không. RadarChart đã dùng `RadarHoverTooltip` custom (file `radar-tooltip.tsx` có comment "Replaces recharts' default Tooltip which follows the cursor and 'jumps'") → đã tự miễn nhiễm. TreemapChart dùng `content={<TooltipContent />}` custom → không bị ảnh hưởng. PieChart không có Tooltip.

**File touched:** `prototype/src/components/charts/LineChart.tsx`, `prototype/src/components/charts/BarChart.tsx`.
