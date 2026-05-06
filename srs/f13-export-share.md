---
name: SRS-13 Export & Share
description: Export PDF report (Cover, Market Overview, Top MUA, Red Flags, Disclaimer) và share link via ngrok với Basic Auth. Phase 3 + 4.
type: feature
module: SRS-13
prd_fr: FR-12
phase: 3 + 4
---

# F13 — Export & Share

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f01-core-screening-pipeline.md](f01-core-screening-pipeline.md), [f06-top-mua-explainability.md](f06-top-mua-explainability.md), [f07-red-flags-risk-warnings.md](f07-red-flags-risk-warnings.md), [f16-authentication.md](f16-authentication.md)
> Related — global: [g02](g02-non-functional-requirements.md) (AC-NF-06 auth required)

## UC-13-01: Export PDF Report

### PDF Structure

```
Page 1: Cover — Run date, model version, total capital
Page 2: Market Overview — KPIs, Pie chart, summary
Page 3+: Top MUA — Per stock: score, confidence, entry, stop loss, allocation, reasons
Page N-1: Red Flags — Excluded stocks table
Page N: Disclaimer
```

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-13-01 | PDF chứa tất cả mã MUA với đủ thông tin (score, confidence, stop loss, allocation) |
| AC-13-02 | PDF có Disclaimer ở trang cuối |
| AC-13-03 | PDF có run date + model_version |

## UC-13-02: Share Link

### Flow
Tạo unique URL → copy to clipboard → PO gửi qua ngrok

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-13-04 | Link yêu cầu Basic Auth trước khi xem |
| AC-13-05 | Link hiển thị read-only results (không sửa được) |
