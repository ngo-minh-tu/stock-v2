# VN Real Estate AI Screener — Prototype (Cluster 1: Shell & Foundation)

> *Dữ liệu dẫn đường, quyết định thuộc về bạn* — Ngô Minh Tú

UI/UX prototype — **không** phải production code. Mọi data từ MSW mocks. Cụm 1 cung cấp Shell + Foundation cho 5 cụm sau.

---

## 1. Scope cụm 1

- Auth (login/logout với JWT mock single-password)
- AppShell: Sidebar 9 menu + Header (theme dropdown, locale toggle, logout) + Disclaimer footer
- 4 theme: `classic-dark` (default), `classic-light`, `light`, `oled`
- i18n VIE/ENG (next-intl), VIE default, fallback VIE
- Settings page: 2 sections (theme, language). Còn lại = placeholder cụm 6.
- Mock API qua MSW: `POST /api/auth/login`, `PUT /api/auth/password`, `GET /api/version`, `GET /api/health`, `GET /api/settings`, `PUT /api/settings`. Catch-all `/api/*` trả 404 envelope chuẩn.
- 8 placeholder pages = `<ComingSoon clusterNumber={N} />`.

---

## 2. Scripts

```bash
npm install          # install deps
npm run dev          # dev server, port 3000, MSW worker auto-start
npm run build        # next build (TypeScript + ESLint)
npm run start        # production server (sau khi build)
npm run lint         # next lint
npm run msw:init     # regenerate public/mockServiceWorker.js (chạy 1 lần đã có)
```

Yêu cầu: **Node 20+** (Next 14 không hỗ trợ Node 17 cũ).

---

## 3. Env vars

Cụm 1 chưa cần `.env`. Mọi mock data hard-coded trong `src/mocks/`. Khi backend thật vào (cụm sau), document ở đây các vars: `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_ENABLE_MSW`, …

---

## 4. Project structure

```
src/
├── app/                            # Next.js App Router
│   ├── layout.tsx                  # Provider stack: MSW → Locale → Theme → Auth
│   ├── (auth)/login/page.tsx
│   └── (app)/                      # ProtectedRoute group
│       ├── layout.tsx              # AppShell wrapper
│       ├── page.tsx                # Dashboard placeholder (cluster 2)
│       ├── top-mua/page.tsx        # cluster 2
│       ├── red-flags/page.tsx      # cluster 2
│       ├── stock-detail/page.tsx   # cluster 3
│       ├── price-board/page.tsx    # cluster 4
│       ├── news/page.tsx           # cluster 4
│       ├── portfolio/page.tsx      # cluster 5
│       ├── run-history/page.tsx    # cluster 5
│       └── settings/page.tsx       # real (theme + language)
├── components/
│   ├── auth/{LoginForm,ProtectedRoute}.tsx
│   ├── common/{Button,Input,Select,ComingSoon,MswBootstrap}.tsx
│   ├── layout/{AppShell,Sidebar,Header,Disclaimer}.tsx
│   └── settings/{ThemePicker,LanguagePicker}.tsx
├── contexts/{AuthContext,ThemeContext,LocaleContext}.tsx
├── lib/{api,constants,types}.ts
├── messages/{vi,en}.json
├── mocks/
│   ├── handlers.ts                 # 6 MSW handlers + catch-all
│   └── data/{settings,version}.ts
└── styles/{globals,themes}.css
```

---

## 5. Theme convention

Áp dụng qua `<html data-theme="...">`. CSS variables ở [src/styles/themes.css](src/styles/themes.css) export đầy đủ tokens cho 4 trạng thái:

| Key | Mô tả | Source |
|---|---|---|
| `classic-dark` | Default, surface tím đậm + accent crimson | design.md §4.1 |
| `classic-light` | Surface light + accent crimson — toggle "Sáng" của Classic | derived |
| `light` | Light đầy đủ | design.md §4.2 |
| `oled` | True black | design.md §4.3 |

**Stock market colors** (`--ssi-up`, `--ssi-down`, `--ssi-ref`, `--ssi-ceil`, `--ssi-floor`, `--ssi-stable`) được khai báo trong từng theme block — cụm 2-3 sẽ dùng cho price board / charts.

**Flash-of-default-theme**: `themeBootScript` (in `ThemeContext.tsx`) chạy inline trong `<head>` trước khi React mount, đọc `localStorage.theme` và set `data-theme` ngay.

---

## 6. i18n convention

- Library: `next-intl` (client-side only, KHÔNG dùng locale URL prefix vì single-user MVP)
- Locale state quản lý bằng `LocaleContext` + persist `localStorage.locale`
- Default + fallback = `vi`
- Key naming: `<page>.<section>.<key>` (ví dụ: `auth.login.passwordPlaceholder`, `settings.theme.options.classic-dark`)
- Khi thêm key mới → bổ sung vào CẢ HAI `messages/vi.json` + `messages/en.json`. Missing key → render literal key (visible regression).

---

## 7. MSW pattern

### 7.1 Bootstrap

`MswBootstrap` (in [src/components/common/MswBootstrap.tsx](src/components/common/MswBootstrap.tsx)) khởi động worker chỉ khi `NODE_ENV === 'development'`. Children render sau khi worker ready, đảm bảo fetch đầu tiên đã được intercept.

`msw/browser` import phải là **dynamic** + được alias false trên server (xem [next.config.js](next.config.js)) vì `msw` package exports khoá `node` resolution.

### 7.2 Response envelope

Theo TAD g05 §3:

```ts
{ success: true, data: T }
// hoặc
{ success: false, error: { code, message, detail? } }
```

Helper `apiFetch<T>()` trong [src/lib/api.ts](src/lib/api.ts) tự attach `Authorization: Bearer {token}`, parse envelope, handle 401 (logout + redirect) và 409 (`JobConflictError`).

### 7.3 Thêm endpoint mock cho cluster sau

```ts
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // ...existing...

  // Ví dụ: cluster 2 cần GET /api/runs/:run_id/dashboard
  http.get('/api/runs/:run_id/dashboard', ({ params }) => {
    const data = buildDashboardFixture(params.run_id as string);
    return HttpResponse.json({ success: true, data });
  }),
];
```

Quy tắc:

1. Đặt fixture lớn (>30 dòng) vào `src/mocks/data/<feature>.ts` — handlers gọn.
2. Response phải khớp shape ở `tad/g02-api.md` (Section 4 ví dụ Stock Detail).
3. Catch-all `/api/*` ở cuối handlers chain trả 404 envelope — KHÔNG xoá; nó là phanh an toàn cho endpoint chưa mock.
4. Async POST endpoints (refresh, screening run) trả `202` + job_id; status polling là endpoint riêng.
5. Lỗi mock dùng cùng shape: `{ success: false, error: { code: 'JOB_CONFLICT', message: '...' } }` với HTTP status phù hợp (409, 400, 401, 404, 500).

---

## 8. Acceptance check (cluster 1)

| AC | Status |
|---|---|
| 1. `npm install && npm run dev` chạy port 3000, MSW log enabled | ✅ |
| 2. `/` chưa login → redirect `/login` | ✅ ProtectedRoute |
| 3. Login bất kỳ password → redirect `/`, AppShell render | ✅ |
| 4. 8 menu non-Settings → ComingSoon đúng cluster | ✅ |
| 5. Đổi theme/language → UI update ngay | ✅ |
| 6. F5 sau khi đổi → giữ state | ✅ localStorage |
| 7. Logout → clear token, redirect `/login` | ✅ |
| 8. Disclaimer footer mọi page sau login | ✅ |
| 9. 4 themes contrast OK | ✅ tokens theo design.md |
| 10. Responsive: desktop 240px, tablet 64px icon-only, mobile drawer | ✅ |
| 11. `npm run build` pass | ✅ |
| 12. README đủ | ✅ |

---

## 9. KHÔNG nằm trong cụm 1

- Charts (Lightweight Charts, Recharts) — cluster 2-3
- TanStack Table — cluster 4
- Real auth backend — cluster sau
- Settings sections: thresholds, sources, telegram, password — cluster 6
- AG-Grid + Highcharts: **không dùng** trong toàn project (TAD §2 chốt khác).
