# PROMPT — CỤM 1: Shell & Foundation

> **Prototype UI/UX** trong `/Users/ngominhtu/Projects/stock-v2/prototype/` (folder đã tạo) — đây là prototype để test UX, KHÔNG implement business logic thực. Mọi data từ MSW mocks.
>
> Cụm đầu tiên, base cho 5 cụm còn lại.

---

## 0. Context — Đọc trước khi code

Bạn đang code prototype frontend trong workspace `/Users/ngominhtu/Projects/stock-v2/`. Đọc các tài liệu sau theo thứ tự để có context đầy đủ:

1. `docs/PRD_v0.5A_Final_Locked.md` — Product requirements (đặc biệt §1.4, §8, §11, §14)
2. `docs/design.md` — SSI Design System (full)
3. `tad/00-tad-system-overview.md` — Tech stack §2, project structure §3
4. `tad/g02-api.md` — API endpoint registry, response shapes
5. `tad/g05-cross-cutting.md` — Error response standard
6. `tad/c08-auth.md` — Auth flow (JWT)
7. `tad/c09-theme-i18n.md` — Theme + i18n architecture
8. `srs/f15-settings.md`, `srs/f16-authentication.md`, `srs/f17-theme-i18n.md` — SRS chi tiết cho 3 features cụm này

---

## 1. Mục tiêu cụm

Xây **Shell & Foundation** cho prototype:
- Auth flow (login/logout với JWT mock)
- Layout shell (sidebar + header + footer disclaimer)
- 4 theme states (Classic Dark/Light, Light, OLED) với theme switcher
- i18n VIE/ENG (next-intl), VIE default, switcher ở header
- Settings page chỉ 2 sections: theme + language
- Mock API layer (MSW) cho 6 endpoints

Cụm này là **base** — 5 cụm sau cắm pages/features vào AppShell + dùng MSW pattern này. KHÔNG implement business logic/charts/screening trong cụm này.

---

## 2. Tech stack (chốt theo TAD §2)

| Layer | Choice | Note |
|---|---|---|
| Framework | Next.js 14+ App Router | TypeScript strict |
| Styling | Tailwind CSS + CSS Custom Properties | Mirror SSI tokens từ design.md |
| i18n | next-intl | VIE default |
| Mock API | MSW (Mock Service Worker) | Browser worker cho dev |
| Font | Roboto qua `next/font/google` | |
| Icons | Lucide React | TAD chưa chốt — chọn Lucide cho cụm này, các cụm sau theo |
| State | React Context + localStorage | Auth, Theme, Locale |

**KHÔNG dùng:** AG-Grid, Highcharts (design.md §10 nhắc nhưng TAD §2 chốt khác — TanStack Table + Lightweight Charts + Recharts sẽ vào cụm sau).

---

## 3. Project structure

Tạo trong `/Users/ngominhtu/Projects/stock-v2/prototype/`:

```
prototype/
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root: AuthProvider + ThemeProvider + LocaleProvider
│   │   ├── (auth)/login/page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx             # AppShell (sidebar + header + main + disclaimer)
│   │   │   ├── page.tsx               # Dashboard placeholder
│   │   │   ├── top-mua/page.tsx       # Placeholder "Coming in cluster 2"
│   │   │   ├── red-flags/page.tsx     # Placeholder
│   │   │   ├── stock-detail/page.tsx  # Placeholder
│   │   │   ├── price-board/page.tsx   # Placeholder
│   │   │   ├── news/page.tsx          # Placeholder
│   │   │   ├── portfolio/page.tsx     # Placeholder
│   │   │   ├── run-history/page.tsx   # Placeholder
│   │   │   └── settings/page.tsx      # Theme + language only (cụm này)
│   ├── components/
│   │   ├── layout/{AppShell,Sidebar,Header,Disclaimer}.tsx
│   │   ├── auth/{LoginForm,ProtectedRoute}.tsx
│   │   ├── settings/{ThemePicker,LanguagePicker}.tsx
│   │   └── common/{Button,Input,Select}.tsx
│   ├── contexts/{AuthContext,ThemeContext,LocaleContext}.tsx
│   ├── lib/
│   │   ├── api.ts                     # fetch wrapper + Bearer token
│   │   ├── constants.ts               # Mirror TAD enums (RunStatus, Theme, Locale)
│   │   └── types.ts                   # Mirror TAD response shapes
│   ├── mocks/
│   │   ├── browser.ts                 # MSW setup
│   │   ├── handlers.ts                # 6 handlers
│   │   └── data/{settings,version}.ts
│   ├── messages/{vi.json,en.json}
│   ├── styles/
│   │   ├── globals.css                # Tailwind + CSS vars
│   │   └── themes.css                 # 4 theme blocks
│   └── i18n.ts                        # next-intl config
├── public/
├── tailwind.config.ts
├── next.config.js
├── tsconfig.json
├── package.json
└── README.md
```

---

## 4. Theme — 4 states (chốt từ PRD §8.2 + design.md §4)

### 4.1 4 trạng thái

| State key | Source | Note |
|---|---|---|
| `classic-dark` | design.md §4.1 (theme-classic) | **Default** |
| `classic-light` | **Tự derive** | Surface từ Light theme (design.md §4.2), nhưng giữ accent crimson + buy/sell — đây là toggle "Sáng" trong Classic theme |
| `light` | design.md §4.2 (theme-light) | Theme Light đầy đủ |
| `oled` | design.md §4.3 (theme-oled) | True black |

`classic-light` rule (vì design.md không định nghĩa):
- Lấy surface tokens từ `theme-light` (`#ededed`, `#ffffff`, `#f4f4f4`...)
- Lấy text tokens từ `theme-light`
- Giữ nguyên accent: `--color-theme-crimson: #d32f2f`, `--color-theme-buy: #1aa67c`, `--color-theme-sell: #c9111f`
- Stock market semantic colors theo Light variant ở design.md §3.2

### 4.2 Implementation

- `themes.css` chứa 4 selectors: `[data-theme="classic-dark"]`, `[data-theme="classic-light"]`, `[data-theme="light"]`, `[data-theme="oled"]`
- Apply qua `<html data-theme={theme}>`
- Theme switcher ở Header: dropdown 4 options (KHÔNG cycle button — 4 states quá nhiều cho cycle)
- Persist trong `localStorage["theme"]`
- Load theme TRƯỚC khi React mount (script trong `<head>`) để tránh flash

### 4.3 Stock market colors

Setup `--ssi-up`, `--ssi-down`, `--ssi-ref`, `--ssi-ceil`, `--ssi-floor`, `--ssi-stable` theo design.md §3.2 cho từng theme. Cụm này chưa dùng nhưng phải define sẵn để cụm 2-3 dùng được ngay.

---

## 5. i18n (next-intl)

- VIE = `vi`, ENG = `en`. VIE default, fallback VIE.
- Locale qua `localStorage["locale"]` + URL không cần locale prefix (single-user MVP).
- Switch ở Header: 2-button group `VIE | ENG` (PRD §8.3 "góc trên phải").
- Tất cả text user-facing đi qua key. Convention: `<page>.<section>.<key>`, ví dụ `auth.login.passwordPlaceholder`.

`messages/vi.json` cần có ít nhất các key cho:
- `app.brand.name = "Ngô Minh Tú"`, `app.brand.tagline = "Dữ liệu dẫn đường, quyết định thuộc về bạn"`
- `auth.login.*` (title, password label/placeholder, submit button, error)
- `nav.*` (9 menu items: dashboard, topMua, redFlags, stockDetail, priceBoard, news, portfolio, runHistory, settings)
- `settings.theme.*` (label, options × 4)
- `settings.language.*`
- `common.disclaimer` (đầy đủ theo PRD §14: *"Công cụ chỉ hỗ trợ phân tích, KHÔNG phải khuyến nghị đầu tư chính thức..."*)
- `common.placeholder.cluster2`, `common.placeholder.cluster3`, etc. cho 8 placeholder pages

`messages/en.json` translate đầy đủ.

---

## 6. Auth flow

### 6.1 Login page (`/login`)

- 1 input `password` (không username — single-user MVP per c08-auth)
- Submit → `POST /api/auth/login { password }`
- Success → store token vào localStorage["token"], redirect `/`
- Failure (mock không fail nhưng giữ UI) → toast error
- Style: card center màn hình, theme-aware

### 6.2 ProtectedRoute

- Wrap `(app)` group
- Nếu không có token trong localStorage → redirect `/login`
- Render loading skeleton trong lúc check

### 6.3 Logout

- Header có nút logout (icon)
- Clear localStorage["token"], redirect `/login`

### 6.4 API wrapper (`lib/api.ts`)

```typescript
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T>
// - Auto attach Authorization: Bearer {token}
// - Handle 401 → logout + redirect /login
// - Handle 409 CONFLICT → throw JobConflictError (cụm 2 dùng)
// - Parse {success, data} | {success, error} envelope theo g05
```

---

## 7. Mock API (MSW)

Setup MSW worker trong development. 6 handlers:

| Endpoint | Response | Source |
|---|---|---|
| `POST /api/auth/login` | `{ success: true, data: { token: "mock-jwt-" + Date.now(), expires_in: 86400 } }` | c08 §2 |
| `PUT /api/auth/password` | `{ success: true }` | c08 |
| `GET /api/version` | TAD g02 §3 payload đầy đủ | g02 §3 |
| `GET /api/health` | `{ status: "ok", active_job: null }` | g02 §3 |
| `GET /api/settings` | Default settings từ TAD §8 Table 12 (theme=CLASSIC, classic_mode=DARK, language=VIE, etc.) | g03 Table 12 |
| `PUT /api/settings` | Echo request body với updated_at | |

Catch-all handler trả 404 với error envelope chuẩn (g05 §3) để báo "endpoint chưa mock — cụm sau implement".

MSW `setupWorker` enable chỉ trong `process.env.NODE_ENV === 'development'`.

---

## 8. Layout (AppShell)

### 8.1 Sidebar

- Width 240px desktop, collapse → 64px tablet, drawer trên mobile
- 9 menu items theo PRD §8.6, mỗi item: icon + label (i18n key) + active state
- Order: Dashboard, Top MUA, Red Flags, Stock Detail, Price Board, News, Portfolio, Run History, Settings
- Active item highlight bằng `--color-theme-crimson` border-left + text bold

### 8.2 Header

- Logo + brand "Ngô Minh Tú" + tagline (i18n)
- Bên phải: Theme dropdown | Locale toggle (VIE|ENG) | Logout icon button
- Sticky top, height 56px

### 8.3 Main content area

- Padding 24px desktop, scroll independent
- Children render trong đây

### 8.4 Disclaimer footer

- Hiển thị mọi page (PRD §14)
- Text: i18n key `common.disclaimer`
- Style: small text, muted color, padding-y 16px, border-top

---

## 9. Settings page (cụm này: 2 sections)

`/settings` page với 2 sections rõ ràng:

### 9.1 Theme section
- Label "Giao diện" / "Theme"
- 4 radio cards (preview small + label) cho 4 themes
- Apply ngay khi click + sync với context + persist localStorage + PUT /api/settings (fire-and-forget)

### 9.2 Language section
- Label "Ngôn ngữ" / "Language"
- 2 radio: VIE / ENG
- Apply ngay khi click

> Các section khác của Settings (sources, telegram, threshold, password) — placeholder "Coming in cluster 6".

---

## 10. Placeholder pages (8 pages)

Các page chưa làm trong cụm này render component `<ComingSoon clusterNumber={N} />`:
- Dashboard, Top MUA, Red Flags, Stock Detail → Cluster 2-3
- Price Board, News → Cluster 4
- Portfolio, Run History → Cluster 5

Component show: tiêu đề trang + dòng "Tính năng này sẽ có trong Cluster {N}" + icon.

---

## 11. Acceptance criteria

1. `cd prototype && npm install && npm run dev` chạy port 3000, MSW console log "Mocking enabled"
2. Hit `/` chưa login → redirect `/login`
3. Login với bất kỳ password → redirect `/`, sidebar + header hiển thị
4. Click 8 menu non-Settings → ComingSoon page với cluster number đúng
5. Settings page: đổi theme → đổi UI ngay (4/4 themes test); đổi language → text VIE↔ENG ngay
6. F5 sau khi đổi theme/language → giữ state
7. Logout → clear token, redirect /login
8. Disclaimer hiển thị footer mọi page sau login
9. 4 themes render không lỗi contrast nghiêm trọng (text đọc được trên surface)
10. Responsive: desktop full sidebar, tablet collapse, mobile drawer
11. `npm run build` pass TypeScript + lint
12. README.md có: scripts, env vars, theme/i18n convention, MSW pattern, "cách thêm endpoint mock cho cluster sau"

---

## 12. Deliverables

- `/prototype/` Next.js project hoàn chỉnh
- `/prototype/README.md` (≤200 dòng)
- 1 commit duy nhất với message mô tả scope cụm 1

---

## 13. Lưu ý cuối

- **KHÔNG** implement business logic, charts, screening, polling. Sai scope = phải làm lại.
- **KHÔNG** dùng AG-Grid hay Highcharts (dù design.md §10 nhắc).
- Khi gặp ambiguity giữa PRD và design.md → theo PRD. Giữa PRD và TAD về tech → theo TAD.
- Mock data values lấy từ TAD/PRD trực tiếp, đừng tự bịa.
- Brand: "Ngô Minh Tú — Dữ liệu dẫn đường, quyết định thuộc về bạn".
