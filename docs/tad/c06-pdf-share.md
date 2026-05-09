---
id: c06
title: PDF Export & Share Link
parent: 00-tad-system-overview.md
type: component
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§16)
---

# c06 — PDF Export & Share Link

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)
>
> Implements: [../srs/f13-export-share.md](../srs/f13-export-share.md)
>
> Related — global: [g03-database.md](g03-database.md) (`share_links` table; reads `screening_results` for export), [g07-deployment.md](g07-deployment.md) (`PDF_TEMPLATE_DIR`, weasyprint dependency, transaction rules during PDF generation)

---

## 1. PDF Export

> [v1.1 SHOULD-FIX] PDF MVP: text/table only, no charts

**PDF:** weasyprint. HTML template → PDF. Pages: Cover → Summary KPIs → Top MUA (table with scores, stop loss, allocation) → Red Flags (table) → Disclaimer. No chart images in MVP — charts are frontend-only.

---

## 2. Share Link

UUID token stored in `share_links` table. Expires 7 days. `GET /share/{token}` requires Basic Auth (same password). Read-only view.
