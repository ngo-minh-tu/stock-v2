---
id: c06
title: PDF Export & Share Link
parent: 00-tad-system-overview.md
type: component
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§16); cluster 6 reconciliation 2026-05-09
version: v1.4 LOCKED (cluster 6 reconciliation)
---

# c06 — PDF Export & Share Link

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)
>
> Implements: [../srs/f13-export-share.md](../srs/f13-export-share.md)
>
> Related — global: [g03-database.md](g03-database.md) (`share_links` table; reads `screening_results` for export), [g07-deployment.md](g07-deployment.md) (`PDF_TEMPLATE_DIR`, weasyprint dependency, transaction rules during PDF generation)

## Changelog

- **v1.4 (2026-05-09, cluster 6 reconciliation):** ❌ REMOVED 1-line stubs §1 (PDF) + §2 (Share) → ✅ REPLACED bằng full architecture §1-§9: PDF MVP HTML serve as application/pdf, iframe sandbox preview, uuid v4 fallback, share-store singleton, share URL 2 forms, public route outside (app), 7-day TTL, prototype token vs production ngrok+Basic Auth, ShareLinksManagement.

---

## 1. PDF Export

### 1.1 Production Target — weasyprint

> [v1.1 SHOULD-FIX] PDF MVP: text/table only, no charts.

**Backend production:** weasyprint. HTML template → PDF binary. Pages: Cover → Summary KPIs → Top MUA (table với scores, stop loss, allocation) → Red Flags (table) → Disclaimer. **No chart images** trong MVP — charts là frontend-only.

### 1.2 Prototype MVP — HTML Serve as application/pdf

Prototype dùng HTML giả serve qua `Content-Type: application/pdf` để trigger download flow. Mock handler `GET /api/export/pdf/{run_id}`:

```ts
const html = buildPdfHtml({ summary, dashboard, results, excluded, brand, tagline });
return new Response(html, {
  status: 200,
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="run-${run_id}.pdf"`,
  },
});
```

`buildPdfHtml()` build HTML string với inline CSS (palette match design.md §3, không phụ thuộc theme runtime — PDF cần consistent xuất ra). Sections: header (brand+tagline+meta) → Tổng quan KPI grid → Top 10 MUA table → Top 20 Red Flags table → Disclaimer → Footer timestamp.

**Trade-off:** file `.pdf` mở bằng PDF reader sẽ broken (nó là HTML); mở bằng browser sẽ render OK. Acceptable cho prototype UX validation.

### 1.3 Backend Phase Replacement

Replace `mocks/data/pdf-template.ts` bằng weasyprint Python module. Frontend KHÔNG đổi — endpoint shape, Content-Type, Content-Disposition giữ nguyên.

---

## 2. iframe Preview Pattern

`<PdfPreviewModal>` render iframe với HTML preview trước khi user confirm download:

```tsx
<iframe
  srcDoc={htmlString}
  sandbox=""              // tối thiểu privilege
  className="w-full h-full border-0"
/>
```

**`sandbox=""` (empty value)** disable mọi privilege:
- ❌ No script execution
- ❌ No form submission
- ❌ No link navigation
- ❌ No top-level navigation
- ✅ CSS embedded vẫn work
- ✅ Image vẫn render

**Lý do:** preview HTML có thể chứa data từ run (ticker names, scores) — không cần execute gì. Sandbox tránh XSS surface nếu mai mốt có user-controlled content trong template.

---

## 3. Share Link

### 3.1 Token Generation — uuid v4 + fallback

```ts
function generateToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for env không có Web Crypto API (testing)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```

`crypto.randomUUID()` first (browser/Node 19+), fallback Math.random regex pattern cho test env.

### 3.2 Store Singleton

`share-store.ts` qua `globalThis.__shareStore` (giống pattern cluster 2 runs-store, cluster 5 portfolio/backtest):

```ts
class ShareStore {
  private byToken = new Map<string, ShareLink>();
  list(): ShareLink[]            { /* sort newest first */ }
  get(token: string): ShareLink? { /* */ }
  create(run_id: string, days = 7): ShareLink { /* */ }
  remove(token: string): void    { /* */ }
  isExpired(link, nowMs): boolean { return nowMs > Date.parse(link.expires_at); }
}

export const shareStore = (globalThis.__shareStore ??= new ShareStore());
```

Khởi đầu rỗng — không seed link nào.

### 3.3 ShareLink Shape

```ts
type ShareLink = {
  token: string;          // uuid v4
  run_id: string;
  url: string;             // mock store URL: https://app.example/share/{token}
  created_at: string;     // ISO
  expires_at: string;      // ISO, +7 days
};
```

---

## 4. Share URL — 2 Forms

| Form | Where | Used by |
|---|---|---|
| **Mock backend URL** | `https://app.example/share/{token}` | Stored in `share-store` (ShareLink.url field — match TAD spec) |
| **Origin-relative** | `${window.location.origin}/share/{token}` | Button "Sao chép" actually copies — user mở được trên cùng tab |

**Rationale:** prototype chạy ở `localhost:3001`, nếu copy mock URL `https://app.example/...` → user mở sẽ broken (no DNS). Button copy override với `window.location.origin` cho prototype-friendly. Backend production: trả URL relative (`/share/{token}`), frontend tự build với origin runtime.

---

## 5. Public Route — `/share/[token]`

### 5.1 Routing

Next.js App Router file `frontend/src/app/share/[token]/page.tsx` — **đặt outside `(app)` group** để bypass `<ProtectedRoute>` (xem [c08 §3](c08-auth.md)).

```
src/app/
├── (app)/                  # protected routes
│   ├── layout.tsx          # wraps with <AuthProvider><ProtectedRoute>
│   ├── page.tsx            # Dashboard
│   └── ...
├── share/
│   └── [token]/
│       └── page.tsx        # PUBLIC route
└── login/
    └── page.tsx            # PUBLIC route
```

### 5.2 force-dynamic Config

```tsx
// share/[token]/page.tsx
export const dynamic = 'force-dynamic';
```

Lý do: Next không pre-render token-specific routes (each token unique). Force runtime resolution.

### 5.3 Prototype Auth Check

```tsx
const link = await fetchShareView(token);  // GET /api/share/{token}
if (!link) return <NotFoundCard />;        // token invalid
if (isExpired(link)) return <ExpiredCard />;
return <SharedView data={link.data} />;
```

**Production:** PRD §7.12 yêu cầu ngrok + HTTP Basic Auth wrap toàn bộ `/share/{token}` URL ở reverse proxy level. Prototype chỉ check token + expiry (không Basic Auth thực) — note rõ trong UX disclaimer.

---

## 6. SharedView TopMuaTable readOnly Mode

`<TopMuaTable readOnly>` prop:
- Ẩn expander column (không cho expand reasons)
- Ticker text thành `<span>` (không bấm vào Stock Detail)

**Rationale:** shared view không có session → click ticker sẽ vào ProtectedRoute → redirect login. Pattern ẩn navigation triggers cho readOnly views.

Pattern này có thể tái dụng ở các page tương lai nếu cần "preview-only" mode.

---

## 7. 7-day TTL

`expires_at = created_at + 7 days`. Helper `isExpired(link, nowMs)` check at every fetch.

Settings → "Quản lý chia sẻ" section list active links với hover hint "Hết hạn còn N ngày" (red nếu < 1 ngày).

Backend cron task (production): mỗi 24h delete `share_links` where `expires_at < NOW()`. Prototype không cần — store rỗng mỗi reload.

---

## 8. Auth — Prototype vs Production

| Aspect | Prototype | Production (PRD §7.12) |
|---|---|---|
| URL access | Public `/share/{token}` | ngrok tunnel với HTTP Basic Auth credentials |
| Token check | MSW handler trả 404 nếu invalid/expired | FastAPI route ditto |
| Auth layer | None (token = "auth") | Basic Auth wrap ở ngrok config |
| User experience | Open URL → SharedView | Open URL → browser prompt "username/password" → SharedView |

**Prototype disclaimer:** UX đã ghi rõ "Đây là bản preview — không có thật authentication. Production cần ngrok Basic Auth."

---

## 9. ShareLinksManagement (Settings)

Settings page section "Quản lý chia sẻ" (xem [f13 §UC-13-03](../srs/f13-export-share.md), [f15 §UC-15-02](../srs/f15-settings.md)):

```
GET /api/share        → list active links (sort newest first)
DELETE /api/share/{token} → 200 + envelope (xem g02 §8.1 cluster 5 rationale)
```

Click "Thu hồi" → `<DeleteConfirmModal>` (xem [design.md §6.20](../design.md)) "Người đã có link sẽ không thể truy cập nữa." → DELETE → row biến mất.

**Post-MVP:** rate limit / cap số lượng link per run (hiện prototype cho phép unlimited regenerate).
