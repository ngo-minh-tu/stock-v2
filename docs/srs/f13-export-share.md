---
name: SRS-13 Export & Share
description: Export PDF report (Cover, Market Overview, Top MUA, Red Flags, Disclaimer) + share link 7-day TTL với public read-only view + Settings management. Phase 3 + 4.
type: feature
module: SRS-13
prd_fr: FR-12
phase: 3 + 4
version: v1.4 LOCKED (cluster 6 reconciliation)
---

# F13 — Export & Share

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f01-core-screening-pipeline.md](f01-core-screening-pipeline.md), [f04-dashboard-market-overview.md](f04-dashboard-market-overview.md), [f06-top-mua-explainability.md](f06-top-mua-explainability.md), [f07-red-flags-risk-warnings.md](f07-red-flags-risk-warnings.md), [f15-settings.md](f15-settings.md), [f16-authentication.md](f16-authentication.md)
> Related — global: [g02](g02-non-functional-requirements.md) (AC-NF-06 auth required)
> Related — tech: [TAD c06](../tad/c06-pdf-share.md), [TAD g02 §9](../tad/g02-api.md)

## Changelog

- **v1.4 (2026-05-09, cluster 6 reconciliation):** ➕ ADDED UC-13-01 expand: 3 entry points (Dashboard / Top MUA / Run History row), HTML serve as `application/pdf` MVP, iframe sandbox preview pattern, Content-Disposition. UC-13-02 expand: modal auto-create + copy URL + regenerate + 7-day countdown + SharedView (watermark + share-by + Dashboard 5 KPI + 6 visual + Top MUA readOnly + invalid/expired 404 states), 2 link concurrent allowed (post-MVP rate limit). UC-13-03 NEW Settings ShareLinksManagement table + revoke confirm. ❌ AC-13-04 "Basic Auth" wording → ✅ CLARIFIED: prototype = token + expiry check; production needs ngrok + Basic Auth per PRD §7.12. AC-13-06..15.

## UC-13-01: Export PDF Report

### PDF Structure

```
Page 1: Cover — Brand + tagline + run date + meta (model_version, total_capital)
Page 2: Market Overview — KPIs + summary text
Page 3+: Top 10 MUA — Per stock: score, confidence, entry, stop loss, allocation, reasons
Page N-1: Top 20 Red Flags — Excluded stocks table
Page N: Disclaimer + footer timestamp
```

### Entry Points (3 places)

| Entry | Component | Behavior |
|---|---|---|
| Dashboard `/` header | `<ExportPdfButton variant="label" preview>` | Click → fetch PDF → render iframe preview modal → user click "Tải xuống" → `<a download>` blob URL trigger + toast "Đã tải PDF" |
| Top MUA `/top-mua` header | `<ExportPdfButton variant="label" preview>` (label "Xuất PDF Top MUA") | Same flow as Dashboard |
| Run History row action | `<ExportPdfButton variant="icon" preview={false}>` | Click → fetch PDF → trigger download trực tiếp (không preview) + toast |

### Endpoint

`GET /api/export/pdf/{run_id}` — response:
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="run-{id}.pdf"`
- Body: PDF binary (production weasyprint) hoặc HTML string (prototype mock — xem [TAD c06 §1](../tad/c06-pdf-share.md))

### MVP — HTML serve as application/pdf

Prototype dùng HTML giả serve qua `Content-Type: application/pdf` để trigger download flow. **Trade-off:** file `.pdf` mở bằng PDF reader sẽ broken; mở bằng browser sẽ render OK. Acceptable cho prototype UX validation. Production → weasyprint (xem [TAD c06 §1](../tad/c06-pdf-share.md)).

### iframe Preview Pattern

```tsx
<iframe
  srcDoc={htmlString}
  sandbox=""        // tối thiểu privilege: no script, no form, no link
  className="w-full h-full"
/>
```

`sandbox=""` (empty value) disable mọi privilege — preview HTML chỉ render passive content (no script execution, no form submission, no link navigation). CSS embedded trong srcDoc vẫn work.

### Acceptance Criteria — PDF Export

| AC ID | Criteria |
|---|---|
| AC-13-01 | PDF chứa tất cả mã MUA với đủ thông tin (score, confidence, stop loss, allocation, reasons) |
| AC-13-02 | PDF có Disclaimer ở trang cuối |
| AC-13-03 | PDF có run date + model_version trong cover |
| AC-13-06 | 3 entry points: Dashboard / Top MUA / Run History row hoạt động đầy đủ; Dashboard + Top MUA có preview modal; Run History tải trực tiếp |
| AC-13-07 | iframe preview dùng `sandbox=""` (no script/form/link); CSS embedded vẫn render OK |
| AC-13-08 | Response `Content-Type: application/pdf` + `Content-Disposition: attachment; filename="run-{id}.pdf"` |
| AC-13-09 | Prototype MVP = HTML giả serve as application/pdf; production → weasyprint render PDF thật (xem [TAD c06 §1](../tad/c06-pdf-share.md)) |

## UC-13-02: Share Link

### Flow

```
[User click "Chia sẻ"] → ShareLinkModal mở
  → auto-create POST /api/share { run_id, expires_in_days: 7 } → 201 { token, url, expires_at }
  → URL hiện ra (font mono full-width)
  → Click "Sao chép" → clipboard.writeText(${origin}/share/{token}) → toast
  → Click "Tạo link mới" → POST again → token mới + URL update + KHÔNG hủy link cũ
  → Đóng modal
```

### Public SharedView (`/share/[token]`)

**Routing:** Next.js App Router file `/share/[token]/page.tsx` đặt **outside `(app)` group** để bypass `<ProtectedRoute>` (xem [c08 §3](../tad/c08-auth.md)). `force-dynamic` để Next không pre-render token-specific routes.

**Auth check (prototype):** GET `/api/share/{token}` server-side check token tồn tại + chưa expire → 200 SharedViewResponse hoặc 404.

> **Production note:** PRD §7.12 yêu cầu ngrok + Basic Auth wrap `/share/{token}` URL. Prototype chỉ check token + expiry (không Basic Auth thực) — note rõ trong UX disclaimer.

### SharedView Layout

```
┌────────────────────────────────────────────────┐
│ Header: Brand + tagline                        │
│         [Read-only shared view] watermark       │
│         "Chia sẻ bởi Ngô Minh Tú · DD/MM/YYYY"  │
│         "Hết hạn còn 7 ngày..."                 │
├────────────────────────────────────────────────┤
│ Dashboard: 5 KPI + 6 visual                    │
├────────────────────────────────────────────────┤
│ Top MUA table (readOnly mode)                  │
│   - KHÔNG có expander icon                     │
│   - Ticker là `<span>` (không click được)       │
└────────────────────────────────────────────────┘
```

`<TopMuaTable readOnly>` prop ẩn expander column + ticker thành span (không bấm vào Stock Detail). Lý do: shared view không có session → click ticker sẽ vào ProtectedRoute → redirect login.

### TTL — 7 days

`expires_at = created_at + 7 days`. `isExpired(link, nowMs)` helper trong share-store. Sau khi expire → `/share/{token}` trả 404 với card "Link không hợp lệ hoặc đã hết hạn".

### 2 Link Concurrent Allowed

User regenerate link → tạo token mới + URL update; **link cũ KHÔNG bị hủy tự động** — vẫn tồn tại tới khi hết hạn hoặc user revoke thủ công ở Settings.

**Rationale:** prototype không enforce rate limit; user tự revoke khi cần. Post-MVP có thể giới hạn N link/run hoặc auto-revoke link cũ khi regenerate (xem [c06 §9](../tad/c06-pdf-share.md)).

### Acceptance Criteria — Share

| AC ID | Criteria |
|---|---|
| AC-13-04 | Prototype: link yêu cầu **token check + expiry check** trước khi xem (KHÔNG Basic Auth thực). Production: cần ngrok + Basic Auth per PRD §7.12 |
| AC-13-05 | Link hiển thị read-only results (Dashboard + Top MUA) — không sửa được |
| AC-13-10 | Modal auto-create link khi mở; URL hiện font mono full-width; copy URL → clipboard `${window.location.origin}/share/{token}` (KHÔNG hardcode `https://app.example/`) |
| AC-13-11 | Regenerate → tạo token mới; link cũ vẫn active đến khi hết hạn hoặc user revoke thủ công |
| AC-13-12 | Countdown "Hết hạn còn N ngày" trong modal + SharedView header |
| AC-13-13 | Public `/share/[token]` route đặt outside `(app)` group; bypass ProtectedRoute; `force-dynamic` Next config |
| AC-13-14 | TopMuaTable trong SharedView dùng prop `readOnly`: ẩn expander column + ticker thành `<span>` (không click vào Stock Detail) |
| AC-13-15 | Token invalid hoặc expired → 404 card "Link không hợp lệ hoặc đã hết hạn" thay vì redirect login |

## UC-13-03: Settings — ShareLinksManagement

### Tab Location

Settings page → section "Quản lý chia sẻ" (collapsible — xem [f15 §UC-15-03](f15-settings.md)).

### Layout

| Column | Data |
|---|---|
| Token preview | `{token.slice(0,8)}...` (truncate) |
| Run | `run_id` |
| Tạo lúc | `created_at` DD/MM/YYYY HH:mm |
| Hết hạn | `expires_at` DD/MM/YYYY (red nếu < 1 ngày) |
| Hành động | Button "Thu hồi" → DeleteConfirmModal (xem [design.md §6.20](../design.md)) |

Sort: newest first (`created_at DESC`).

### Endpoint

- `GET /api/share` → list active links (token + run_id + created_at + expires_at)
- `DELETE /api/share/{token}` → 200+envelope (xem [TAD g02 §9](../tad/g02-api.md))

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-13-16 | Settings → "Quản lý chia sẻ" section list các link đang active sort newest first |
| AC-13-17 | Click "Thu hồi" → DeleteConfirmModal "Người đã có link sẽ không thể truy cập nữa." → DELETE /api/share/{token} → row biến mất + toast |
| AC-13-18 | Sau revoke, mở `/share/{token}` (link cũ) → 404 "Link không hợp lệ" |
