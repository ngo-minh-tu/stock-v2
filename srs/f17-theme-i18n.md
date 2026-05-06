---
name: SRS-17 Theme System & i18n
description: 4 trạng thái theme (CLASSIC dark/light, LIGHT, OLED) và i18n VIE/ENG, instant switch không reload. Phase 4.
type: feature
module: SRS-17
prd_fr: FR-14 (partial)
phase: 4
---

# F17 — Theme System & i18n

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f15-settings.md](f15-settings.md)
> Related — global: [g03](g03-appendix-enums-constants.md) (Theme, ClassicMode, Language enums)

## UC-17-01: Switch Theme (Phase 4)

### 4 States

| Selection | Result |
|---|---|
| theme=CLASSIC, classic_mode=DARK | Nền #020210, text light |
| theme=CLASSIC, classic_mode=LIGHT | Nền trắng/xám nhạt, text dark |
| theme=LIGHT | Nền #EDEDED, text dark. Toggle ẩn. |
| theme=OLED | Nền true black, text light. Toggle ẩn. |

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-17-01 | Toggle Sáng/Tối chỉ hiển thị khi theme=CLASSIC |
| AC-17-02 | Chuyển theme → tất cả components update (no flash/reload) |
| AC-17-03 | Màu TTCK VN (trần/sàn/tăng/giảm) giữ nguyên mọi theme |

## UC-17-02: Switch Language (Phase 4)

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-17-04 | Nút VIE\|ENG góc trên phải |
| AC-17-05 | Chuyển ngôn ngữ → tất cả labels update, data giữ nguyên |
| AC-17-06 | Ngôn ngữ mặc định = VIE |
| AC-17-07 | Key missing → fallback VIE |
