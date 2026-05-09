---
id: g06
title: Testing Strategy & Fixtures
parent: 00-tad-system-overview.md
type: global
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§22)
---

# g06 — Testing Strategy & Fixtures

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)

---

## 1. 5 Mock Tickers

| Ticker | Scenario | Expected |
|---|---|---|
| MOCK_BUY_STRONG | High score, good fundamentals | MUA, BUY_STRONG |
| MOCK_BUY_WARN | Score OK, D/E=3.2 | MUA, BUY_NOW, 1 badge, -5pp |
| MOCK_HOLD | Mixed signals | GIỮ, NO_ENTRY |
| MOCK_SELL | Negative growth, high debt | BÁN, NO_ENTRY |
| MOCK_INSUFFICIENT | Missing indicators | INSUFFICIENT_DATA |

---

## 2. Test Categories

Unit (pytest) → Integration (pytest + httpx) → Contract (engine interfaces) → E2E (full run with mocks)
