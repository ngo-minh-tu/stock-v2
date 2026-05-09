---
id: c09
title: Theme & i18n Architecture
parent: 00-tad-system-overview.md
type: component
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§19)
---

# c09 — Theme & i18n

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)
>
> Implements: [../srs/f17-theme-i18n.md](../srs/f17-theme-i18n.md)
>
> Related — global: [g05-cross-cutting.md](g05-cross-cutting.md) (frontend logging respects locale; error messages localized via i18n keys)

---

## 1. Theme

**4 Theme States:** Classic Dark (default), Classic Light (toggle), Light, OLED. CSS Custom Properties. TTCK VN colors unchanged across themes.

Asset: `frontend/src/styles/themes.css`.

---

## 2. i18n

**i18n:** next-intl. VIE default. ENG full. Nút VIE|ENG góc trên phải. Key missing → fallback VIE.

Assets: `frontend/src/i18n/vi.json`, `frontend/src/i18n/en.json`.
