---
title: 03 — Frontend Stack
source: TAD g05 §4 (provider stack), c08, c09, g01 §4 (hooks), g02 §5 (apiFetch)
---

# 03 — Frontend Stack

Next.js 16.2.6 App Router + Turbopack (default, không còn `--webpack`). Single-user MVP, không SSR session — auth + theme + locale persist trong `localStorage`.

## Provider stack — 7 layers (cluster 2)

Outer → inner. Mỗi layer cần outer hơn consumer của nó.

```mermaid
flowchart TB
    Toast["1️⃣ ToastProvider<br/>cluster 2 — viewport cho toast<br/>Run/Auth gọi useToast"]
    Toast --> Mock["2️⃣ MockOutcomeProvider<br/>cluster 2 — dev outcome toggle<br/>persist localStorage"]
    Mock --> Msw["3️⃣ MswBootstrap<br/>cluster 1 — gate render tới khi MSW ready (dev only)"]
    Msw --> Locale["4️⃣ LocaleProvider<br/>next-intl — đọc localStorage.locale"]
    Locale --> Theme["5️⃣ ThemeProvider<br/>data-theme attr — đọc localStorage.theme + classic_mode"]
    Theme --> Auth["6️⃣ AuthProvider<br/>token state — đọc localStorage.token"]
    Auth --> Run["7️⃣ RunProvider<br/>cluster 2 — activeRunId + lastCompletedRunId<br/>+ polling + mount-once hydration"]
    Run --> Children[["children: Next.js routes"]]

    style Toast fill:#fee2e2
    style Mock fill:#fef3c7
    style Msw fill:#fde68a
    style Locale fill:#bbf7d0
    style Theme fill:#bfdbfe
    style Auth fill:#ddd6fe
    style Run fill:#fbcfe8
```

**Order rationale (g05 §4):**

| Layer | Tại sao ở vị trí này |
|---|---|
| Toast | Outermost vì Run + Auth call `useToast()` |
| MockOutcome | Outer than Auth → dev tester toggle outcome trước khi login |
| MswBootstrap | Outer than network-callers → MSW phải start trước mọi `apiFetch` |
| Locale | Outer than Theme → label theme switcher hiển thị theo locale |
| Theme | Outer than Auth → toàn app (kể cả `/login`) có theme đúng |
| Auth | Outer than Run → RunProvider check token validity trước khi gọi `/api/run` |
| Run | Innermost — mọi page dùng `useRun()` |

## Route groups

```mermaid
flowchart LR
    subgraph App["src/app/"]
        AppGroup["(app)/<br/>protected via ProtectedRoute<br/>───<br/>page.tsx (Dashboard)<br/>top-mua · red-flags · stock-detail<br/>price-board · news · portfolio<br/>run-history · backtest · settings"]
        AuthGroup["(auth)/<br/>public<br/>───<br/>login/page.tsx"]
        ShareGroup["share/[token]/page.tsx<br/>PUBLIC route<br/>force-dynamic<br/>bypass ProtectedRoute"]
    end

    AppLayout["(app)/layout.tsx<br/>wraps <ProtectedRoute>"]:::layout
    AppGroup --> AppLayout

    classDef layout fill:#e0e7ff,stroke:#4338ca;
```

## Key hooks & utilities

```mermaid
flowchart LR
    apiFetch["apiFetch&lt;T&gt;(path, init)<br/>g02 §5<br/>───<br/>• Bearer auto-inject<br/>• Parse {success, data} envelope<br/>• 401 → clear token + redirect /login<br/>• 409 → throw JobConflictError<br/>• 5xx/network → throw Error"]

    usePolling["usePolling&lt;T&gt;<br/>g01 §4.1<br/>───<br/>• 2000ms interval<br/>• cancelledRef (NOT useState)<br/>• enabled gate<br/>• auto-stop on isTerminal"]

    useApiResource["useApiResource&lt;T&gt;<br/>g01 §4.2<br/>───<br/>• GET-once<br/>• reloadKey trigger<br/>• cancel-on-unmount"]

    RunCtx["RunContext<br/>g01 §4.3-4.5<br/>───<br/>• activeRunId<br/>• lastCompletedRunId broadcast<br/>• runsHydrated flag<br/>• mount-once hydration<br/>(GET /api/runs?limit=1)"]

    apiFetch --> usePolling
    apiFetch --> useApiResource
    usePolling --> RunCtx
    useApiResource --> Pages

    RunCtx -. lastCompletedRunId bump .-> Pages["Pages reload pattern<br/>useEffect → bump reloadKey<br/>→ useApiResource refetch"]
```

## Bundle composition (cluster 1-3)

```mermaid
pie title Frontend bundle highlights (TAD §2)
    "Lightweight Charts (~40KB)" : 40
    "Recharts (~60KB)" : 60
    "TanStack Table (~25KB)" : 25
    "next-intl (~10KB)" : 10
    "Lucide tree-shaken (~5KB used)" : 5
```

## Theme system (c09)

```mermaid
flowchart LR
    BootScript["Anti-flash boot script<br/>(inline in &lt;head&gt;)"] --> Resolve["resolveDataTheme(theme, classicMode)"]
    Resolve --> SetAttr["document.documentElement<br/>data-theme=..."]
    SetAttr --> CSS

    subgraph CSS["themes.css — 4 blocks"]
        D["[data-theme='classic-dark']<br/>purple-black"]
        L["[data-theme='classic-light']<br/>cool-blue"]
        Pure["[data-theme='light']<br/>pure neutral"]
        OLED["[data-theme='oled']<br/>true black"]
    end

    CSS --> Vars["--ssi-up / --ssi-down / --ssi-ref<br/>(TTCK colors UNCHANGED across themes)<br/>+ --color-theme-* surface tokens"]

    Vars --> Recharts["Recharts SVG fill<br/>auto-resolved (no re-render)"]
    Vars --> LWChart["Lightweight Charts canvas<br/>MutationObserver → repaint<br/>(c10)"]
```

## Notes

- **localStorage keys** (g03 §L Frontend Constants): `token`, `theme`, `classic_mode`, `locale`, `stock-v2:candlestick-ma-toggles`, `stock-v2:section:{key}` (CollapsibleSection).
- **Cluster 6 dự kiến** thêm `<ShareProvider>` cho `/share/[token]` public route (xem [g05 §4](../tad/g05-cross-cutting.md)).
- **MSW** chỉ chạy ở `NODE_ENV=development`. Production frontend gọi backend FastAPI thực qua `NEXT_PUBLIC_API_URL` — `apiFetch` không cần đổi (xem [g05 §5](../tad/g05-cross-cutting.md)).
- **Stock Detail candlestick** dùng pattern riêng vì canvas không follow CSS vars — chi tiết [c10](../tad/c10-stock-detail-chart.md) (MutationObserver + 2-tier selector + MA overlays + 1500-day padding + multiplicative scaling).
