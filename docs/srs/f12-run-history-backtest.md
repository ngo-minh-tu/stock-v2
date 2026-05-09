---
name: SRS-12 Run History & Backtest
description: Danh sách runs, so sánh 2 runs, và backtest core với Recommendation Accuracy + Price Error + Portfolio ROI vs VN-Index Alpha. Phase 3 + 4.
type: feature
module: SRS-12
prd_fr: FR-10
phase: 3 + 4
---

# F12 — Run History & Backtest

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f01-core-screening-pipeline.md](f01-core-screening-pipeline.md)
> Related — global: [g03](g03-appendix-enums-constants.md) (RunStatus, BACKTEST_HOLD_RETURN_*, BACKTEST_SELL_UNDERPERFORM)

## UC-12-01: View Run History

### List Display
Danh sách runs, mới nhất trước

| Column | Data |
|---|---|
| Run ID | run_id |
| Thời gian | run_at |
| Tổng scored | scored_count |
| MUA/GIỮ/BÁN | buy/hold/sell counts |
| Model | model_version |
| Data source | "Live" hoặc "Cache" |

## UC-12-02: Compare 2 Runs

### Input
run_id_A, run_id_B

### Output

```
{
  added_to_buy: ticker[],      // A=không MUA → B=MUA
  removed_from_buy: ticker[],  // A=MUA → B=không MUA
  score_changes: [{ticker, score_A, score_B, delta}],
  new_warnings: [{ticker, badge}],
  resolved_warnings: [{ticker, badge}]
}
```

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-12-01 | Compare hiển thị mã thay đổi khuyến nghị |
| AC-12-02 | Score delta hiển thị + (green) hoặc - (red) |

## UC-12-03: Backtest Core

### Preconditions
≥2 historical runs với actual price data available

### Metrics Calculated

| Metric | Formula | Definition |
|---|---|---|
| Recommendation Accuracy | correct_count / total_count × 100 | MUA đúng: 3M return >0% AND outperform VN-Index. GIỮ đúng: 3M return -7% to +12%. BÁN đúng: 3M return <0% OR underperform >5% |
| Price Error | mean(\|predicted - actual\| / actual × 100) | Avg absolute % error |
| Portfolio ROI | (portfolio_end - portfolio_start) / portfolio_start × 100 | Giả lập mua tất cả MUA theo allocation weights |
| VN-Index ROI | (vnindex_end - vnindex_start) / vnindex_start × 100 | Cùng kỳ |
| Alpha | Portfolio ROI - VN-Index ROI | Outperformance |

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-12-03 | Recommendation accuracy dùng đúng correctness definition (PRD 4.5) |
| AC-12-04 | Price error là mean absolute, không phải mean signed |
| AC-12-05 | Portfolio ROI giả lập dùng allocation weights, chưa tính phí/slippage |
| AC-12-06 | Alpha = Portfolio ROI - VN-Index ROI, hiển thị + hoặc - |
