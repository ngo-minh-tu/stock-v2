---
id: c09
title: Theme & i18n Architecture
parent: 00-tad-system-overview.md
type: component
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§19); cluster 1 reconciliation 2026-05-09
version: v1.2 LOCKED (post-prototype reconciliation)
---

# c09 — Theme & i18n

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)
>
> Implements: [../srs/f17-theme-i18n.md](../srs/f17-theme-i18n.md)
>
> Related — global: [g05-cross-cutting.md](g05-cross-cutting.md) (frontend provider stack, logging respects locale; error messages localized via i18n keys)

## Changelog

- **v1.2 (2026-05-09, cluster 1 reconciliation):** ➕ Bổ sung §1.1 (data-theme resolution rule), §1.2 (anti-flash boot script), §3 (provider stack order), §4 (icon library — Lucide React). ❌ REMOVED `frontend/src/i18n/` path → ✅ REPLACED bằng `frontend/src/messages/` (next-intl convention thực sự).
- **v1.3 (2026-05-09, cluster 2 reconciliation):** ❌ REMOVED §3 4-layer provider stack inline (outdated sau cluster 2 expand 4→7 layers) → ✅ REPLACED bằng pointer-to [g05 §4] (single source of truth). Tránh duplicate spec (rule "nồi cám").

---

## 1. Theme

**4 Theme States:** Classic Dark (default), Classic Light (toggle), Light, OLED. CSS Custom Properties. TTCK VN colors unchanged across themes.

Asset: `frontend/src/styles/themes.css`.

### 1.1 `data-theme` resolution rule

Settings store giữ cặp `(theme: Theme, classic_mode: ClassicMode)`. CSS render qua attribute `data-theme` trên `<html>` element, resolve theo rule:

```ts
function resolveDataTheme(theme: Theme, classicMode: ClassicMode): string {
  if (theme === 'CLASSIC') {
    return classicMode === 'LIGHT' ? 'classic-light' : 'classic-dark';
  }
  return theme.toLowerCase();  // 'light' | 'oled'
}
```

4 theme blocks trong `themes.css`:
- `[data-theme='classic-dark']` — purple-black (`#020210`), accent crimson
- `[data-theme='classic-light']` — cool-blue tint (hue ~215°, B > R = G), accent crimson preserved (xem design.md §4.4)
- `[data-theme='light']` — pure neutral grays
- `[data-theme='oled']` — true black

Mỗi block khai báo đầy đủ `--ssi-up/down/ref/ceil/floor/stable` (TTCK colors) — không inherit cross-theme để tránh đổi màu chứng khoán khi switch theme.

### 1.2 Anti-flash boot script

Khi user reload trang ở dark theme, browser default render light → React mount → đổi sang dark = **flash trắng**. Fix: inline boot script trong `<head>` chạy TRƯỚC khi React mount, đọc `localStorage.theme` + `localStorage.classic_mode` rồi set `data-theme` ngay:

```ts
// ThemeContext.tsx exports themeBootScript as string
export const themeBootScript = `
  (function() {
    try {
      var theme = localStorage.getItem('theme') || 'CLASSIC';
      var classicMode = localStorage.getItem('classic_mode') || 'DARK';
      var resolved = theme === 'CLASSIC'
        ? (classicMode === 'LIGHT' ? 'classic-light' : 'classic-dark')
        : theme.toLowerCase();
      document.documentElement.setAttribute('data-theme', resolved);
    } catch (e) {}
  })();
`;

// app/layout.tsx
<head>
  <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
</head>
```

---

## 2. i18n

**i18n:** next-intl. VIE default. ENG full. Nút VIE|ENG góc trên phải. Key missing → fallback VIE.

Assets: `frontend/src/messages/vi.json`, `frontend/src/messages/en.json` (next-intl convention dùng path `messages/`, KHÔNG phải `i18n/`).

**Locale persistence:** `localStorage.locale` (KHÔNG URL prefix `/vi/...`, `/en/...`). Lý do: single-user MVP, không cần SEO multi-locale URL, đơn giản hóa routing.

---

## 3. Provider Stack Order

> [v1.3] Chi tiết đầy đủ + rationale tại [g05 §4 Frontend Provider Stack](g05-cross-cutting.md). Cluster 2 mở rộng từ 4 → **7 layers** (thêm ToastProvider, MockOutcomeProvider, RunProvider).

Tóm tắt outer → inner: `Toast` → `MockOutcome` → `MswBootstrap` → `Locale` → `Theme` → `Auth` → `Run`.

Cluster 1 (4 layers) dùng `Msw → Locale → Theme → Auth`; cluster 2 (7 layers) thêm Toast outermost (Run/Auth gọi useToast), MockOutcome outer than Msw (dev toggle trước login), Run innermost (mọi page dùng useRun).

---

## 4. Icon Library

**Lucide React** (~5KB tree-shake mỗi icon). Chọn vì:
- Tree-shake tốt: chỉ bundle icons thực dùng.
- `currentColor` mặc định → tự động theme-aware không cần override stroke/fill.
- API `<IconName size={16} />` đơn giản, đồng nhất với Tailwind sizing.

Pattern: import từng icon `import { Settings, Sun, Moon } from 'lucide-react'`. Không import default bundle.
