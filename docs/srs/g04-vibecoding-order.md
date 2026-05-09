---
name: Vibecoding Order — Implementation Priority
description: Thứ tự 38 step vibecoding chia 4 phase (Core Engine → Core UI → Extended → Polish), tuân thủ dependency graph. Mỗi Step phải pass AC liên quan trước khi chuyển Step tiếp theo.
type: global
source: SRS §25
---

# G04 — Implementation Priority & Vibecoding Order

> Parent: [00-system-overview.md](00-system-overview.md)
> Tuân thủ dependency graph trong overview §4. **Rule: Mỗi Step phải pass AC liên quan trước khi chuyển Step tiếp theo.**

## Phase 1 — Core Engine (Weeks 1-4)

```
Step 1:  Project skeleton (FastAPI + Next.js + SQLite)
Step 2:  Domain types & enums (xem g03-appendix)
Step 3:  38 Scoring Feature constants + 8 Raw Indicator constants
Step 4:  Mock data fixtures (5 mã mẫu, đủ để test pipeline)
Step 5:  Whitelist loader (~81 mã)
Step 6:  vnstock data ingestion + cache layer
Step 7:  4 vòng lọc (Red Flags → Price → Liquidity → Data)        → f01
Step 8:  Feature Engineering — 38 features                         → f02
Step 9:  Baseline Scoring Engine (rule-based, cùng interface XGBoost)
Step 10: Baseline Price Engine (simple, cùng interface LSTM)
Step 11: Entry Point Engine — 7 enum, priority order               → f03
Step 12: Risk calculation (stop loss + allocation + warning badges) → f07, f09
Step 13: Run persistence (screening_runs + screening_results)
Step 14: Walk-Forward validation framework (4 đợt)
```

## Phase 2 — Core UI (Weeks 4-9)

```
Step 15: Auth (login page + middleware)                 → f16
Step 16: Layout shell (sidebar + header + content area)
Step 17: Dashboard page (5 charts + 5 KPI cards)        → f04
Step 18: Top MUA page (TanStack Table + expand row + explainability) → f06
Step 19: Red Flags page (Section A excluded + Section B warnings)  → f07
Step 20: Stock Detail page (candlestick + radar + breakdown) → f08
Step 21: RunButton + CapitalModal + RunStatusCard + Toast → f01
Step 22: API integration (connect FE → BE)
```

## Phase 3 — Extended (Weeks 9-12)

```
Step 23: Price Board page (TanStack Table)              → f05
Step 24: News crawler (5 sources, RSS first)            → f10
Step 25: Sentiment analysis pipeline (GUARD-08)         → f10
Step 26: News page (list + filters)                     → f10
Step 27: Portfolio Lite (CRUD + P&L)                    → f11
Step 28: Run History page (list + compare 2 runs)       → f12
Step 29: Telegram bot integration                       → f14
Step 30: PDF export basic                               → f13
```

## Phase 4 — Polish (Weeks 12-14)

```
Step 31: Theme system (4 states)                        → f17
Step 32: i18n VIE/ENG (next-intl)                       → f17
Step 33: design.md integration (colors, fonts, spacing)
Step 34: Share link via ngrok                           → f13
Step 35: Backtest Core (3 metrics + correctness def)    → f12
Step 36: Settings page full                             → f15
Step 37: Bug fixes + performance tuning
Step 38: Final QA against all AC-*
```
