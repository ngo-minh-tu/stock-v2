---
name: System Overview
description: Tổng quan SRS v1.2 — VN Real Estate AI Screener. Mô tả phạm vi, actor, dependency và index trỏ tới 4 file global (g*) + 17 file tính năng (f*).
type: overview
source: docs/SRS_v1.0_VN_RealEstate_AI_Screener.md (v1.0 baseline); cluster 1 reconciliation 2026-05-09 (bump v1.2)
version: v1.2 LOCKED (post-prototype reconciliation)
---

# 00 — System Overview

> *Dữ liệu dẫn đường, quyết định thuộc về bạn*

## Changelog

- **v1.2 (2026-05-09, cluster 1 reconciliation):** Bump version 1.0 → 1.2 đồng bộ với cluster 1 reconciliation. Document Flow: ❌ SRS v1.0 → ✅ SRS v1.2. Các file f15, f16, f17, g03 đã có changelog riêng. Files f01-f14, g01, g02, g04 chưa reconcile — sẽ touch khi đến cluster tương ứng.

| Field | Details |
|---|---|
| SRS Version | 1.2 (post-prototype reconciliation) |
| PRD Reference | v0.5A Final Locked (May 4, 2026) |
| Document Flow | PRD v0.5A → **SRS v1.2** → Technical Design Document |
| Audience | Dev / AI Coding Agent / QA |
| Language | Vietnamese (primary) + English (technical terms) |
| Author | Ngô Minh Tú — BA: Claude AI |

---

## 1. Mục đích & Conventions

SRS này chuyển đổi PRD v0.5A (WHAT) thành đặc tả có thể kiểm thử (HOW TO VERIFY). Mỗi Functional Requirement trong PRD được tách thành Use Cases với: Preconditions, Input, Steps, Output, Acceptance Criteria.

- `MUST` = bắt buộc cho phase được ghi
- `SHOULD` = nên có, có thể defer
- `AC-XXX-NN` = Acceptance Criteria ID
- `ERR-XXX-NN` = Error state ID
- `UC-XXX-NN` = Use Case ID

---

## 2. System Context & Boundaries

```
┌─────────────────────────────────────────────────┐
│                 VN RE AI Screener                │
│                                                  │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐ │
│  │ Frontend  │──│  Backend  │──│  AI Engine   │ │
│  │ Next.js   │  │  FastAPI  │  │ XGBoost+LSTM │ │
│  └──────────┘  └───────────┘  └──────────────┘ │
│                      │                           │
│                ┌─────┴─────┐                     │
│                │  SQLite   │                     │
│                └───────────┘                     │
└────────────────────┬────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   ┌─────────┐ ┌──────────┐ ┌──────────┐
   │ vnstock │ │ 5 nguồn  │ │ SBV/GSO  │
   │  API    │ │ tin tức   │ │  crawl   │
   └─────────┘ └──────────┘ └──────────┘
```

### External Systems

| System | Type | Direction | Rate Limit |
|---|---|---|---|
| vnstock | Python library | Read | 0.5s delay/call, cache 24h |
| CafeF | RSS/HTML crawl | Read | Respect robots.txt |
| VnExpress | RSS/HTML crawl | Read | Respect robots.txt |
| Vietstock | RSS/HTML crawl | Read | Respect robots.txt |
| Batdongsan.com.vn | RSS/HTML crawl | Read | Respect robots.txt |
| Thanh Niên/Tuổi Trẻ | RSS/HTML crawl | Read | Respect robots.txt |
| SBV/GSO | Web crawl | Read | Cache theo tháng/quý |
| Telegram Bot API | REST API | Write | Sau manual run only |

---

## 3. Actor Definitions

| Actor | Description | Auth |
|---|---|---|
| Product Owner (PO) | Người dùng duy nhất giai đoạn MVP | Basic Auth |
| System (Scheduler) | KHÔNG có trong MVP — manual run only | N/A |
| AI Scoring Engine | XGBoost hoặc Baseline Engine | Internal |
| AI Price Engine | LSTM hoặc Baseline Fallback | Internal |
| Entry Point Engine | Deterministic rules engine | Internal |
| News Crawler | Crawl + Sentiment pipeline | Internal |

---

## 4. Module Map & Dependencies

```
SRS-16 Auth ─────────────────────────────────┐
                                              ▼
SRS-02 Feature Eng ◄── SRS-01 Screening ──► SRS-03 Entry Logic
        │                    │                    │
        ▼                    ▼                    ▼
   SRS-09 Risk Mgmt    SRS-06 Top MUA ◄──── SRS-08 Stock Detail
        │                    │                    │
        │               SRS-07 Red Flags          │
        │                    │                    │
        ▼                    ▼                    ▼
   SRS-04 Dashboard ◄── All modules feed ──► SRS-05 Price Board
        │
        ├──► SRS-10 News
        ├──► SRS-11 Portfolio
        ├──► SRS-12 History & Backtest
        ├──► SRS-13 Export
        ├──► SRS-14 Telegram
        └──► SRS-15 Settings ──► SRS-17 Theme & i18n
```

**Critical Path (Phase 1-2):** Auth → Feature Engineering → Screening Pipeline → Entry Logic → Risk Mgmt → Top MUA → Red Flags → Stock Detail → Dashboard

---

## 5. Index — Global Files (g*)

Cross-cutting reference, mọi file `f*` đều có thể tham chiếu.

| File | Nội dung | Nguồn SRS |
|---|---|---|
| [g01-global-errors-and-validation.md](g01-global-errors-and-validation.md) | Global Error States + Data Validation Rules | §22 + §23 |
| [g02-non-functional-requirements.md](g02-non-functional-requirements.md) | Non-Functional Acceptance Criteria (AC-NF-*) | §24 |
| [g03-appendix-enums-constants.md](g03-appendix-enums-constants.md) | **Single source of truth** — Enums, 38 feature IDs, raw indicators, constants | §26 |
| [g04-vibecoding-order.md](g04-vibecoding-order.md) | Vibecoding Order — 38 steps, 4 phases | §25 |

---

## 6. Index — Feature Files (f*)

| File | Module | PRD FR | Phase |
|---|---|---|---|
| [f01-core-screening-pipeline.md](f01-core-screening-pipeline.md) | SRS-01 Core Screening Pipeline | FR-01 | Phase 1 |
| [f02-feature-engineering.md](f02-feature-engineering.md) | SRS-02 Feature Engineering | FR-01 | Phase 1 |
| [f03-entry-point-logic.md](f03-entry-point-logic.md) | SRS-03 Entry Point Logic | FR-01 | Phase 1 |
| [f04-dashboard-market-overview.md](f04-dashboard-market-overview.md) | SRS-04 Dashboard & Market Overview | FR-02 | Phase 2 |
| [f05-price-board.md](f05-price-board.md) | SRS-05 Price Board | FR-03 | Phase 3 |
| [f06-top-mua-explainability.md](f06-top-mua-explainability.md) | SRS-06 Top MUA & Explainability | FR-04 + FR-08 | Phase 2 |
| [f07-red-flags-risk-warnings.md](f07-red-flags-risk-warnings.md) | SRS-07 Red Flags & Risk Warnings | FR-05 | Phase 2 |
| [f08-stock-detail.md](f08-stock-detail.md) | SRS-08 Stock Detail | FR-06 | Phase 2 |
| [f09-risk-management.md](f09-risk-management.md) | SRS-09 Risk Management | FR-07 | Phase 2 |
| [f10-news-sentiment.md](f10-news-sentiment.md) | SRS-10 News & Sentiment | FR-11 | Phase 3 |
| [f11-portfolio-lite.md](f11-portfolio-lite.md) | SRS-11 Portfolio Lite | FR-09 | Phase 3 |
| [f12-run-history-backtest.md](f12-run-history-backtest.md) | SRS-12 Run History & Backtest | FR-10 | Phase 3 + 4 |
| [f13-export-share.md](f13-export-share.md) | SRS-13 Export & Share | FR-12 | Phase 3 + 4 |
| [f14-telegram-bot.md](f14-telegram-bot.md) | SRS-14 Telegram Bot | FR-13 | Phase 3 |
| [f15-settings.md](f15-settings.md) | SRS-15 Settings | FR-14 | Phase 3 + 4 |
| [f16-authentication.md](f16-authentication.md) | SRS-16 Authentication | FR-15 | Phase 2 |
| [f17-theme-i18n.md](f17-theme-i18n.md) | SRS-17 Theme System & i18n | FR-14 (partial) | Phase 4 |

---

## 7. Change Log

| Version | Date | Changes |
|---|---|---|
| v1.0 | 04/05/2026 | Initial SRS from PRD v0.5A. 17 modules, 38 steps vibecoding order, full AC, test fixtures. |
