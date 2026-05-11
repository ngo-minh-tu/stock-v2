# Phase 4 — Engines + Features + Risk REVIEW

**Done:** ~2026-05-10 (~6h, estimate 2d)
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Retrospective focus: phase nặng nhất business logic — fix 5+ Phase 1 drift, DECIMAL scale bug 100x, 5 anchor golden tests.

## Surprises / non-obvious

- **DECIMAL convention vs PERCENT**: 38 features dùng decimal scale (`ROE=0.18 = 18%`). SRS ghi "× 100" = display annotation **trên UI**, KHÔNG phải input scaling. Mình ban đầu nhân 100 → scoring sai 100x → DEBUG: anchor scores VHM ra ~10000. Fix: feature values raw decimal, normalization good/bad bounds cũng decimal.
- **Group weights chốt PRD §4.2**: F=35%, T=20%, M=15%, R=22%, S=8% (sum=100%). Phase 1 đoán 20% mỗi group → 100% nhưng sai semantic weight. F (Fundamental) quan trọng nhất, S (Sentiment) ít nhất.
- **5 anchor tickers golden**: VHM=93 MUA, KDH=87 MUA (HIGH_INVENTORY badge), NLG=80 MUA, DXG=50 GIU, PDR=27 BAN. Test golden cố định values này. **Khi thay đổi feature normalization phải re-verify** — golden test sẽ catch unintended impact.
- **`_safe_div` Decimal/Decimal bug**: SQLAlchemy Numeric → Python Decimal. `Decimal('1.5') / Decimal('2.0') = Decimal('0.75')` OK, nhưng `float(...)` sau divide bị deprecated warning. Fix: cast `float()` ngay khi read column, _safe_div hoạt động với float.
- **CONFIDENCE_PENALTY cap=20, không phải MAX=30**: SRS g03 §K. Phase 1 đoán 30. Đúng: 1 badge=5, 2=10, 3+=15, cap=20. `final_confidence = max(0, raw - min(penalty, cap))`.
- **ENTRY_REASON_CODES 15 canonical** SRS g03 §N — Phase 1 viết 13 token sai. Fix Phase 4 với whitelist regex check.
- **WARNING_BADGES 4 only**: `HIGH_DEBT/NEGATIVE_OCF/LEGAL_RISK/HIGH_INVENTORY`. Phase 1 thừa 6 badges (HIGH_PE, OVERVALUED, etc.) — trim.

## Key decisions (why)

- **Engines ABC interface**: `ScoringEngine`, `PriceEngine`, `EntryEngine`. Baseline impl + XGBoost stub raise `NotImplemented`. DI qua `scoring_baseline` import — swap khi ML ready.
- **Filter pipeline 4 rounds** với reason codes detailed (TAD c01): R1 newly_listed/insufficient_data/penny → R2 high_d_e/legal_block → R3 low_liquidity → R4 (TBD post-MVP).
- **Risk service**: stop_loss = -10% (`STOP_LOSS_DEFAULT_PCT`); allocation max 30% per ticker (`ALLOCATION_WEIGHT_MAX`); confidence penalty escalating per badge count.

## To revisit

- ML stubs `scoring_xgboost.predict()` raise `NotImplemented` → cần training pipeline post-MVP (PRD §3.6).
- Entry engine 7 priority rules ổn — verify lại với edge cases trong Phase 10.
- 38 feature dictionary maintenance: nếu add feature mới cần wire vào `features.py` + `normalize_specs` + golden test fixture.
- `risk_service` warning badges chỉ derive từ raw_indicators — chưa wire qualitative news sentiment signals.
