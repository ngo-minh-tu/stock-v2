# Phase 4 — Engines + Features + Risk

**Ngày:** 2026-05-10
**Mục tiêu thực hiện:** dựng engine ABC + baseline scoring/price/entry, 38-feature service, 4-round filter, risk service (stop-loss + allocation + warning badges + confidence penalty); fix 5+ drift constants từ Phase 1.
**Trạng thái:** COMPLETED 2026-05-10

## 1. Việc đã làm

- Pre-code drift audit: fix 6 drift Phase 1 ngay trong Phase 4 (theo rule clean-first-time):
  - EntrySignal 7 canonical (`INSUFFICIENT_DATA, NO_ENTRY, BUY_STRONG, BUY_NOW, WAIT_FOR_BREAKOUT, WAIT_FOR_PULLBACK, WAIT_FOR_CONFIRMATION`) + `ENTRY_SIGNAL_PRIORITY` map.
  - Recommendation values → ASCII (`MUA/GIU/BAN`) — VIE label render ở UI/i18n.
  - `WARNING_BADGES` trim 10 → 4 canonical (HIGH_DEBT/NEGATIVE_OCF/LEGAL_RISK/HIGH_INVENTORY).
  - `ENTRY_REASON_CODES` 13 sai → 15 canonical (SRS g03 §N).
  - `FILTER_EXCLUSION_CODES` 7 sai → 6 canonical (frontend `EXCLUDED_REASONS`).
  - `CONFIDENCE_PENALTY` MAX=30 sai → 4 constants 5/10/15/cap=20.
- Convention chốt: feature value DECIMAL convention (ROE=0.18). SRS "× 100" = display annotation, không phải input scaling.
- Engines ABC: `base.py` (ScoringEngine, PriceEngine, EntryPointEngine, dataclasses Reason/ScoringResult/PriceResult/EntryInput/EntryResult).
- Baseline scoring (`scoring_baseline.py`): normalize 38 features, group means, weighted sum F=35%/T=20%/M=15%/R=22%/S=8% (PRD §4.2 = 100%), MUA/GIU/BAN từ buy/hold thresholds, top 3 boosters + 1 dragger reasons, radar 5-axis.
- ML stubs: `scoring_xgboost.py` + `price_lstm.py` raise `NotImplementedError`.
- Baseline price: avg(T07/T08/T09) → trend ±50% clamp → target_3m + upside_pct + target_date +90d.
- Entry engine: Step 1-9 deterministic first-match-wins; Step 2 enforce rec≠MUA → NO_ENTRY; Step 9 fallback BUY_NOW.
- Feature service: 38 features từ FinancialReport+StockPrice+macro; raw indicators (SMA20/50/200, EMA12/26, RSI14, MACD, BB, S/R, MACD-cross); missing-data rules + INSUFFICIENT_DATA gate.
- Filter service 4 rounds: red flags (D/E≥4, audit, status, newly listed) → penny (<15K) → liquidity (<300K avg vol) → data completeness (≥4Q + ≥126 days).
- Risk service: stop_loss = ref×0.90; allocation weight ai_score/sum (max 30%, rounding dồn vào weight cao nhất AC-09-04); warning badges 4 canonical với trigger thresholds; confidence_penalty 5/10/15 cap 20.
- 2 repository mới: `financial_repo` (latest, list_latest, count_quarters), `macro_repo` (latest_by_indicator, all_latest); `price_repo` thêm `list_recent`, `list_between`.
- Anchor fixtures 5 ticker (VHM/KDH/NLG/DXG/PDR) full feature dicts + golden ai_scores.
- 5 file tests, +66 cases: 9 scoring + 12 entry + 23 risk + 13 filters + 9 features.

## 2. File đã thêm

- `mvp/code/app/engines/__init__.py`, `base.py`, `scoring_baseline.py`, `scoring_xgboost.py`, `price_baseline.py`, `price_lstm.py`, `entry_engine.py`
- `mvp/code/app/services/feature_service.py`, `filter_service.py`, `risk_service.py`
- `mvp/code/app/repositories/financial_repo.py`, `macro_repo.py`
- `mvp/code/tests/fixtures/__init__.py`, `anchor_features.py`
- `mvp/code/tests/unit/test_scoring.py`, `test_entry.py`, `test_risk.py`, `test_filters.py`, `test_features.py`

## 3. File đã sửa

- `mvp/code/app/constants/enums.py` — EntrySignal 7 + ENTRY_SIGNAL_PRIORITY; Recommendation ASCII.
- `mvp/code/app/constants/reason_codes.py` — rewrite 15 entry codes + 4 warning badges + 6 filter codes + FILTER_ROUND_MAP.
- `mvp/code/app/constants/thresholds.py` — CONFIDENCE_PENALTY_MAX → 4 constants per-badge + cap=20.
- `mvp/code/app/repositories/price_repo.py` — thêm `list_recent`, `list_between`.

## 4. Lệnh đã chạy

```bash
cd mvp/code
uv run pytest                              # 118/118
uv run pytest tests/unit/ -q               # 76 unit
uv run ruff check app tests                # clean

uv run python -c "
from app.engines.scoring_baseline import ScoringBaselineEngine
from tests.fixtures.anchor_features import ANCHORS
eng = ScoringBaselineEngine(buy_threshold=75, hold_min_threshold=45)
for t, a in ANCHORS.items():
    r = eng.score(a['features'])
    print(f'{t}: score={r.ai_score} rec={r.recommendation}')
"
```

## 5. Kết quả

- Pytest: PASS — 118/118 (Phase 0-3: 52, Phase 4 mới: 66).
- Ruff: PASS.
- 5-anchor golden ai_scores deterministic:
  - VHM 93.02 → MUA
  - KDH 87.06 → MUA (HIGH_INVENTORY badge → confidence_penalty 5pp)
  - NLG 80.61 → MUA
  - DXG 50.01 → GIU
  - PDR 26.77 → BAN
- 7 EntrySignal coverage: 8 fixtures SRS f03 pass.
- AC-03-02 + AC-03-09: rec≠MUA → NO_ENTRY (NEGATIVE_RECOMMENDATION).
- AC-09-04: `sum(allocations) == total_capital ±0`.

## 6. Tồn đọng

- **`Recommendation.GIU = "GIU"`** khác Phase 1 "GIỮ" — chưa insert row nào, không cần migration. Phase 5+ insert qua enum.value ASCII.
- **`feature_service.compute()` MACD signal O(N²)** cho dài 200 phiên ≈ 35K ops. Acceptable hiện tại; nếu mở rộng 5y data (1250 phiên) cần memoize.
- **R03 NAV/cp = BVPS × 1.2 default** (PRD §A nói "tính từ BCTC" nhưng MVP không có RNAV pipeline) — fixture override để test pass.
- **R01/R02/R04 sector medians hardcode default** (1000/4/25K) — chưa có sector aggregation pipeline. Caller phải truyền `sector_medians` dict.
- **Macro M01-M04 cần seed:** `macro_data` table empty. Phase 5 sẽ seed minimal stub hoặc Phase 1 seed thêm 5 row defaults.
- **`entry_engine` không track ma20:** EntryInput nhận ma20 từ caller (orchestrator đọc từ `raw_indicators["sma20"]`).
- **Anchor fixtures chỉ 5 mã**, không full 81. Phase 5 sẽ test full 81 end-to-end.
- **ML stubs raise NotImplemented:** XGBoost/LSTM training pipeline post-MVP (PRD §3.6).
- **Risk service warning badges chỉ derive từ raw_indicators** — chưa wire qualitative news sentiment.
