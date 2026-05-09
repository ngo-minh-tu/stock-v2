---
name: SRS-05 Price Board
description: Bảng giá đầy đủ ~81 mã với color-coding TTCK VN, sort/filter, click vào Stock Detail. Phase 3.
type: feature
module: SRS-05
prd_fr: FR-03
phase: 3
---

# F05 — Price Board

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f08-stock-detail.md](f08-stock-detail.md)
> Related — global: [g03](g03-appendix-enums-constants.md) (Recommendation enum)

## UC-05-01: Display Full Price Board

### Preconditions
Whitelist ~81 mã loaded

### Table Specification (TanStack Table)

| Column | Data | Format | Sortable | Filterable |
|---|---|---|---|---|
| Ticker | ticker | String, bold | Yes | Yes (search) |
| Tên | name | String | Yes | Yes |
| Giá | price | Number, color-coded | Yes | No |
| Thay đổi % | change_pct | ±X.XX%, color-coded | Yes | No |
| Khối lượng | volume | Number, formatted | Yes | No |
| Trần | ceiling | Purple #F23AFF | No | No |
| Sàn | floor | Blue #00C9FF | No | No |
| TC | reference | Yellow #FDFF12 | No | No |
| AI Score | ai_score (nếu có run) | 0-100 | Yes | No |
| Khuyến nghị | recommendation | Badge | Yes | Yes (filter) |

### Color Rules
- Giá = Trần → #F23AFF (tím)
- Giá > TC → #0BDF39 (xanh lá)
- Giá = TC → #FDFF12 (vàng)
- Giá < TC → #FF0017 (đỏ)
- Giá = Sàn → #00C9FF (xanh dương)

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-05-01 | Hiển thị tất cả ~81 mã, kể cả mã bị loại (với badge trạng thái) |
| AC-05-02 | Color-coding đúng theo TTCK VN rules |
| AC-05-03 | Click ticker → navigate Stock Detail |
| AC-05-04 | Sort + filter hoạt động đồng thời |
