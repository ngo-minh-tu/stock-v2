# Phase 4 — Engines + Features + Risk

**Status:** COMPLETED 2026-05-10
**Estimate vs actual:** 2d / ~3h
**Spec ref:** [PLAN.md §3 row 4](../../PLAN.md), [SRS f01](../../../docs/srs/f01-core-screening-pipeline.md), [SRS f02](../../../docs/srs/f02-feature-engineering.md), [SRS f03](../../../docs/srs/f03-entry-point-logic.md), [SRS f09](../../../docs/srs/f09-risk-management.md), [SRS g03 §K/§L/§N](../../../docs/srs/g03-appendix-enums-constants.md), [TAD c01](../../../docs/tad/c01-engines.md), [TAD c02](../../../docs/tad/c02-feature-engineering.md), [TAD c03](../../../docs/tad/c03-entry-engine.md), [PRD §4.1-4.5](../../../docs/PRD_v0.5A_Final_Locked.md)

## 1. Scope

- **Engine ABCs + dataclasses** (TAD c01) — `ScoringEngine` + `PriceEngine` + `EntryPointEngine` (deterministic) + `Reason`/`ScoringResult`/`PriceResult`/`EntryInput`/`EntryResult`.
- **Baseline scoring** (TAD c01 §2 + c02 §2 + PRD §4.2) — weighted normalize sum cho 38 features, group weights (35/20/15/22/8 = 100%), MUA/GIU/BAN từ buy/hold thresholds, top boosters + draggers reasons, radar 5-axis output.
- **Baseline price** (PRD §4.1) — naive trend = avg(T07/T08/T09 returns), target_price_3m = current × (1 + trend), upside_pct, target_date = +90d.
- **ML stubs** — `scoring_xgboost.py` + `price_lstm.py` raise `NotImplementedError` (interface compatible).
- **Entry engine** (SRS f03 + cluster 3 lock) — Step 1-9 priority deterministic, first match wins. Step 2 enforce rec≠MUA → NO_ENTRY. Step 9 fallback BUY_NOW. Reason codes whitelist 15-enum.
- **Feature service** (SRS f02 + TAD c02) — 38 features (16 fundamental + 9 technical + 5 macro + 5 RE + 3 sentiment) tính từ `FinancialReport` + `StockPrice` + macro dict. Raw indicators (SMA/EMA/RSI/MACD/Bollinger/S/R/MACD-cross). Missing data rules per SRS §F02.
- **Filter service** (SRS f01 Step 3-6) — 4 round filter pipeline: red flags (D/E≥4, audit, status, newly listed) → penny price (<15K) → liquidity (<300K avg vol) → data completeness (≥4Q + ≥126 days price). `after_round_N` counts.
- **Risk service** (SRS f09) — stop_loss = ref × 0.90; allocation weight = ai_score / sum(ai_score buy); 4 canonical warning badges (HIGH_DEBT/NEGATIVE_OCF/HIGH_INVENTORY/LEGAL_RISK); confidence_penalty 5/10/15 cap 20.
- **Repositories:** `financial_repo` (latest, list_latest, count_quarters), `macro_repo` (latest_by_indicator, all_latest), `price_repo.list_recent` + `list_between` thêm vào.
- **Test fixtures:** 5 anchor tickers (VHM/KDH/NLG/DXG/PDR) full feature dicts + golden ai_scores.

## 2. Pre-code spec audit (drift report)

**6 drift Phase 1 phát hiện trong audit, fix ngay trong Phase 4** (theo memory rule "every cluster phải sạch lần đầu" + Phase 3 SUMMARY §2 pattern):

| # | Drift | File trước | Resolution |
|---|---|---|---|
| 1 | **`EntrySignal` enum sai 7 values**: Phase 1 viết `{BUY_NOW, BUY_DIP, WAIT, HOLD, SELL, INSUFFICIENT_DATA, NO_SIGNAL}`. SRS f03 v1.3 + cluster 3 lock + frontend `ENTRY_SIGNALS` canonical = `{INSUFFICIENT_DATA, NO_ENTRY, BUY_STRONG, BUY_NOW, WAIT_FOR_BREAKOUT, WAIT_FOR_PULLBACK, WAIT_FOR_CONFIRMATION}` | `app/constants/enums.py` | ❌ REMOVE 7 values cũ; ✅ REPLACE bằng 7 canonical states + thêm `ENTRY_SIGNAL_PRIORITY` map (priority 1-7 cho first-match-wins). |
| 2 | **`Recommendation` enum value chứa diacritics**: Phase 1 `MUA="MUA", GIU="GIỮ", BAN="BÁN"`. Frontend `RECOMMENDATIONS = ['MUA','GIU','BAN']` ASCII keys. Sẽ gây mismatch JSON wire | `app/constants/enums.py` | ✅ REPLACE values → `MUA="MUA", GIU="GIU", BAN="BAN"` (ASCII). VIE label render ở UI/i18n layer. |
| 3 | **`WARNING_BADGES` set chứa 10 codes**: Phase 1 đoán thừa (LOW_LIQUIDITY, NEW_LISTED, STALE_DATA, INSUFFICIENT_FEATURES, PROFIT_DECLINE, HIGH_VOLATILITY). SRS f07 + g03 §L + frontend `WARNING_BADGES` canonical = 4 (`HIGH_DEBT, NEGATIVE_OCF, LEGAL_RISK, HIGH_INVENTORY`) | `app/constants/reason_codes.py` | ❌ REMOVE 6 codes thừa; ✅ TRIM về 4 canonical + giữ trigger thresholds (D/E≥3, OCF<0, Inv/TA>60%, R05≥4) trong `risk_service.derive_warning_badges`. |
| 4 | **`ENTRY_REASON_CODES` set 13 token sai whitelist**: Phase 1 dùng OVERSOLD_RECOVERY/EARNINGS_BEAT/INSIDER_BUYING/SUPPORT_HOLD/NEUTRAL_RANGE/WAIT_FOR_DIP/RESISTANCE_REJECTION/BEARISH_TREND/FUNDAMENTAL_DECLINE — SRS g03 §N cluster 3 lock = 15 enum (VALUATION_ATTRACTIVE, BULLISH_TREND, NAV_DISCOUNT, STRONG_FUNDAMENTAL, MACD_BULLISH_CROSS, NEAR_RESISTANCE, NEAR_SUPPORT, OVERBOUGHT, OVERSOLD, WEAK_TREND, AWAIT_BREAKOUT, AWAIT_PULLBACK, AWAIT_CONFIRMATION, NEGATIVE_RECOMMENDATION, INSUFFICIENT_INDICATORS) | `app/constants/reason_codes.py` | ❌ REMOVE 9 token cũ; ✅ REPLACE bằng 15 canonical. Format compose qua `+` separator (TAD g02 §N). |
| 5 | **`FILTER_EXCLUSION_CODES` set 7 code không khớp frontend**: Phase 1 dùng FILTER_NEWLY_LISTED, FILTER_LIQUIDITY_LOW, FILTER_AUDIT_QUALIFIED, FILTER_SUSPENDED, FILTER_NEGATIVE_EQUITY, FILTER_DELISTED, FILTER_INSUFFICIENT_HISTORY — frontend `EXCLUDED_REASONS` lock = 6 (`HIGH_DE, LEGAL_BLOCK, PENNY_PRICE, LOW_LIQUIDITY, INSUFFICIENT_DATA, NEWLY_LISTED`) | `app/constants/reason_codes.py` | ❌ REMOVE 7 codes; ✅ REPLACE bằng 6 canonical + thêm `FILTER_ROUND_MAP` (code → round 1..4) cho audit. |
| 6 | **`CONFIDENCE_PENALTY_MAX = 30`**: Phase 1 đoán sai. SRS g03 §K canonical: `CONFIDENCE_PENALTY_1_BADGE=5, _2_BADGES=10, _3PLUS=15, _CAP=20` | `app/constants/thresholds.py` | ❌ REMOVE `CONFIDENCE_PENALTY_MAX`; ✅ THÊM 4 constants per-badge + cap 20. `risk_service.confidence_penalty_for_badges(count)` áp dụng. |

**Convention decision (không phải drift, document để tránh tranh cãi sau):** SRS f02 ghi "× 100" cho ROE/Net Margin/etc — interpret là **display annotation**, không phải input scaling. Internal `feature_service` giữ DECIMAL convention (ROE=0.18 = 18%) khớp `constants/features.py` good/bad scale (e.g. F03 good=0.20 bad=0.0). Frontend nhân ×100 ở presentation layer khi cần. Lý do: tránh touch 16+ feature constants + giữ math stable; T01 MA Trend 0-100 + RSI 0-100 + Bollinger 0-1 đã mixed convention rồi.

## 3. Deliverables

Tất cả path relative tới `mvp/code/`.

### Mới tạo
| Path | Nội dung |
|---|---|
| `app/engines/__init__.py` | Package marker + roadmap docstring |
| `app/engines/base.py` | ABCs + dataclasses (Reason, ScoringResult, PriceResult, EntryInput, EntryResult, ScoringEngine, PriceEngine) — TAD c01 §1 |
| `app/engines/scoring_baseline.py` | `ScoringBaselineEngine`: normalize 38 features, group means, weighted sum (PRD §4.2 35/20/15/22/8), recommendation từ thresholds, top boosters/draggers reasons, radar |
| `app/engines/scoring_xgboost.py` | STUB raise `NotImplementedError` — load() + score() interface compat |
| `app/engines/price_baseline.py` | `PriceBaselineEngine`: avg(T07/T08/T09) → trend ±50% clamp, target_3m, upside_pct, target_date +90d |
| `app/engines/price_lstm.py` | STUB raise `NotImplementedError` |
| `app/engines/entry_engine.py` | `EntryPointEngine.evaluate(EntryInput) → EntryResult`, Step 1-9 priority order. Reason codes compose qua `+` separator |
| `app/services/feature_service.py` | `FeatureService.compute()` — 38 features từ FinancialReport+StockPrice+macro+RE/sentiment hints. Raw indicators (sma20/50/200, ema12/26, RSI14, MACD line/signal/hist, BB upper/lower, support/resistance, macd_signal_cross). Helpers: _safe_div, _sma, _ema, _rsi, _macd, _bollinger, _support_resistance, _macd_signal_cross. Missing-data rules + INSUFFICIENT_DATA gate |
| `app/services/filter_service.py` | `run_filters(list[StockData]) → FilterResult`. 4 rounds (red flags / penny / liquidity / data). `after_round_N` counts. Constants: `PRICE_FLOOR=15_000, LIQUIDITY_FLOOR=300_000, MIN_QUARTERS=4, MIN_PRICE_DAYS=126, DE_RED_FLAG=4.0` |
| `app/services/risk_service.py` | `compute_risk()` (stop_loss + warnings + confidence), `derive_warning_badges()`, `confidence_penalty_for_badges()`, `allocate_capital()` (rounding fix dồn ±1đ vào weight cao nhất) |
| `app/repositories/financial_repo.py` | `list_latest(ticker, limit)`, `latest()`, `count_quarters()` |
| `app/repositories/macro_repo.py` | `latest_by_indicator()`, `all_latest()` |
| `tests/fixtures/__init__.py` | Package marker |
| `tests/fixtures/anchor_features.py` | 5 anchor feature dicts (VHM/KDH/NLG/DXG/PDR) + `_full_feature_dict()` helper, `ANCHORS` dict, `get_anchor()` lookup |

### Sửa
| Path | Thay đổi |
|---|---|
| `app/constants/enums.py` | EntrySignal 7 canonical + ENTRY_SIGNAL_PRIORITY map; Recommendation values → ASCII |
| `app/constants/reason_codes.py` | Rewrite — 15 entry reason codes + 4 warning badges + 6 filter exclusion codes + FILTER_ROUND_MAP |
| `app/constants/thresholds.py` | CONFIDENCE_PENALTY_MAX → CONFIDENCE_PENALTY_1_BADGE/_2_BADGES/_3PLUS/_CAP |
| `app/repositories/price_repo.py` | + `list_recent(ticker, limit)`, `list_between(ticker, start, end)` |

### Tests mới (5 file, +66 cases)
| Path | Cases |
|---|---|
| `tests/unit/test_scoring.py` | 9 cases: GROUP_WEIGHTS sum=1, anchor scores in range, anchor recommendations golden (VHM/KDH/NLG=MUA, DXG=GIU, PDR=BAN), reasons populated boost+drag, radar shape, P/E≤0 → score 0, empty features safe |
| `tests/unit/test_entry.py` | 12 cases: 8 fixtures TF-03-01..08 từ SRS f03 + step2_sell + step9_fallback + step4_priority + reason_code_whitelist (GUARD-02) |
| `tests/unit/test_risk.py` | 23 cases: stop_loss buy/current, 4 warning badges trigger, no badges clean, badges ⊆ canonical 4, penalty 0/5/10/15/15 (parametrize), penalty applied, confidence cap≥0, allocation skipped+higher-score-higher+sum=capital+empty+weights=1+dataclass |
| `tests/unit/test_filters.py` | 13 cases: healthy passes, round1 (HIGH_DE/audit/delisted/newly listed), round2 penny + boundary 15K, round3 liquidity, round4 quarters+price-history, after_round counts decreasing, total_input == after_r1 + excluded_r1 (AC-01-03), codes ⊆ canonical |
| `tests/unit/test_features.py` | 9 cases: 38 features full set, no extras (AC-02-02), T01/T03/T05 ranges (AC-02-06,07), insufficient_data flag, NEGATIVE_OCF warning, raw_indicators populated, end-to-end feature → scoring engine |

## 4. Exit criteria — all PASS

- `uv run pytest` → **118/118 pass** (Phase 0-3: 52, Phase 4 mới: 66 = 9 scoring + 12 entry + 23 risk + 13 filters + 9 features)
- `uv run ruff check app tests` → All checks passed
- 5-anchor golden ai_scores deterministic:
  - VHM: 93.02 → MUA
  - KDH: 87.06 → MUA (có HIGH_INVENTORY badge → confidence_penalty 5pp)
  - NLG: 80.61 → MUA
  - DXG: 50.01 → GIU
  - PDR: 26.77 → BAN
- 7 EntrySignal coverage: SRS f03 8 fixtures pass (BUY_STRONG/BUY_NOW/WAIT_FOR_BREAKOUT/WAIT_FOR_PULLBACK/WAIT_FOR_CONFIRMATION/NO_ENTRY/INSUFFICIENT_DATA + step9 fallback)
- AC-03-02 + AC-03-09 enforce: rec≠MUA → NO_ENTRY (NEGATIVE_RECOMMENDATION reason)
- AC-09-04: sum(allocations) == total_capital ±0 (rounding fix dồn vào weight cao nhất)

## 5. Quyết định khoá trong phase này

| Mục | Giá trị | Lý do |
|---|---|---|
| Group weights | F=35%, T=20%, M=15%, R=22%, S=8% | PRD §4.2 lock |
| Feature value scale | DECIMAL convention (ROE=0.18) | Khớp constants/features.py (good=0.20). SRS "×100" = display annotation. Frontend nhân ×100 ở presentation. |
| Confidence raw formula | `50 + abs(ai_score - 50)` (50..100) | Baseline pseudo predict_proba; XGBoost sau swap qua `model.predict_proba`. Backtest reproducible. |
| Reasons output | top 3 boost (≥70) + top 1 drag (<35) | Cluster 3 reason-codes UI hiển thị tối đa 4-5 chip. Predictable output cho regression test. |
| Allocation rounding | dồn ±1đ vào weight cao nhất | Đảm bảo AC-09-04 sum=capital strict. Tránh truncation drift dồn nhỏ giọt. |
| Warning badge thresholds | D/E≥3 (HIGH_DEBT), OCF<0 (NEGATIVE_OCF), Inv/TA>0.60 (HIGH_INVENTORY), R05≥4 (LEGAL_RISK) | Khớp `frontend/src/mocks/data/warning-badges.ts` trigger text |
| Confidence penalty cap | 20pp absolute (3+ badges → 15pp + cap nhỏ hơn 20) | SRS g03 §K |
| Entry engine "raw indicators required" | 8 (SMA20/50/200, EMA12/26, BB upper/lower, MACD signal). Threshold INSUFFICIENT_DATA = thiếu ≥2 = available < 7 (= required-1) | SRS f03 Step 1 wording "thiếu ≥2 raw technical indicators" |
| Step 9 fallback | BUY_NOW (AC-03-07) | Mã MUA không match Step 3-8 vẫn có signal. Reason = BULLISH_TREND |
| Price baseline trend cap | ±50% (clamp) | Tránh edge case feature outlier khiến target_price phi lý |
| Anchor fixtures decimal | 5 mã hardcode dict thay vì simulate vnstock | Test SQLite không có historical data; deterministic golden cho regression test |

## 6. Issues / drift

- **`Recommendation.GIU = "GIU"` khác Phase 1 `"GIỮ"`**: bất kỳ row `screening_results.recommendation` cũ trong dev DB sẽ là literal string "GIỮ" (utf-8). Phase 1-3 chưa insert row nào → không cần migration. Phase 5 onwards insert qua enum.value = "GIU".
- **`feature_service.compute()` chạy MACD signal trong loop n từ 35..len(prices)**: O(N²) cho dài 200 phiên ≈ 35K × 35 ops. Acceptable cho 81 mã × 200 prices, nhưng nếu mở rộng dài hơn (5y data ~1250 phiên) cần memoize. TODO post-MVP.
- **R03 NAV/cp = BVPS × 1.2 default**: PRD §A appendix nói "tính từ BCTC" nhưng MVP không có RNAV detailed analysis → fallback BVPS × 1.2 (proxy). Phase 4 fixture override R03 để test pass.
- **R01/R02/R04 sector medians hardcode**: chưa có sector-level aggregation pipeline. Caller (screening_service Phase 5) cần truyền `sector_medians` dict — Phase 4 service nhận optional, default empty.
- **Macro M01-M04 cần seed**: `macro_data` table empty hiện tại. Phase 5 screening_service phải seed minimal macro stub trước khi run, hoặc Phase 1 seed thêm 5 row macro defaults. ⚠️ Sẽ revisit ở Phase 5.
- **`entry_engine` không track ma20**: EntryInput nhận ma20 từ caller. Caller (screening_service) phải đọc từ `feature_service.raw_indicators["sma20"]` rồi feed vào. SMA20 chính là MA20 cho Step 4-5 (theo SRS f03 Step 4 "price > ma20"). Documented trong screening_service Phase 5.
- **Anchor fixtures chỉ có 5 mã, không full 81**: PLAN.md exit criteria nói "golden 5-mã pass với expected scores" — đủ cho Phase 4. Phase 5 sẽ test full 81 mã end-to-end.

## 7. Test commands (reproducible)

```bash
cd mvp/code

uv run pytest                              # 118 pass
uv run pytest tests/unit/ -q               # 76 pass (unit only)
uv run ruff check app tests                # clean

# Anchor scores quick check
uv run python -c "
from app.engines.scoring_baseline import ScoringBaselineEngine
from tests.fixtures.anchor_features import ANCHORS
eng = ScoringBaselineEngine(buy_threshold=75, hold_min_threshold=45)
for t, a in ANCHORS.items():
    r = eng.score(a['features'])
    print(f'{t}: score={r.ai_score} rec={r.recommendation}')
"
# VHM: 93.02 MUA · KDH: 87.06 MUA · NLG: 80.61 MUA · DXG: 50.01 GIU · PDR: 26.77 BAN
```

## 8. Hand-off cho Phase 5

Phase 5 (Screening Orchestrator) sẽ wire:
- `app/services/screening_service.py` — orchestrate filter → feature → score → price → entry → risk → bulk insert (Phase 4 deliverables hoán vào).
- `app/api/screening.py` — POST /run async + 409 lock, GET /runs, /runs/{id}, /runs/{id}/status (live duration + progress), DELETE /runs/{id}.
- `app/repositories/screening_repo.py` + `results_repo.py` + `excluded_repo.py`.
- `app/services/screening_service.py` cần seed macro_data minimal nếu DB trống (M01..M05 fallback constants).
- Status transitions: PENDING → CHECKING_DATA (vnstock fetch / cache) → SCREENING (filter) → SCORING (feature+score+price+entry+risk) → terminal.
- Test `tests/integration/test_run_lifecycle.py` end-to-end POST /run trên 81 seed mã → COMPLETED + 81 rows screening_results; 2 POST song song → 2nd 409.

Đã sẵn sàng:
- 4-round filter (Phase 4) ✓
- Feature engineering (Phase 4) ✓
- Engines (Phase 4) ✓
- Risk service (Phase 4) ✓
- Job lock + refresh layer (Phase 3) ✓
- Cache infrastructure (Phase 3) ✓
- 81 stocks seeded (Phase 1) ✓

⚠️ **Phase 5 phải audit lại drift**: macro_data seed thiếu? screening_results model có đủ field cho Phase 4 outputs? `recommendation` value migration cũ "GIỮ"→"GIU"?

## 9. Post-phase fixes

*(append entry mỗi khi user request fix Phase 4 sau khi phase đã đóng)*
