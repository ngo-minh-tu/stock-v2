---
name: SRS-17 Theme System & i18n
description: 4 trạng thái theme (CLASSIC dark/light, LIGHT, OLED) và i18n VIE/ENG, instant switch không reload. Phase 4.
type: feature
module: SRS-17
prd_fr: FR-14 (partial)
phase: 4
version: v1.2 LOCKED (post-prototype reconciliation)
---

# F17 — Theme System & i18n

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f15-settings.md](f15-settings.md)
> Related — global: [g03](g03-appendix-enums-constants.md) (Theme, ClassicMode, Language enums)

## Changelog

- **v1.2 (2026-05-09, cluster 1 reconciliation):** Lock classic-light visual identity (cool-blue tint hue ~215°, distinct from light theme — chi tiết palette tại design.md §4.4). Bổ sung anti-flash mechanism (boot script đọc localStorage trước React mount). Lock `--ssi-*` TTCK colors khai báo trong cả 4 themes. AC-17-08..11 mới.

## UC-17-01: Switch Theme (Phase 4)

### 4 States — resolved `data-theme` attribute

CSS theme được áp qua attribute `data-theme` trên `<html>`, resolve từ cặp `(theme, classic_mode)`:

| settings.theme | settings.classic_mode | resolved `data-theme` | Visual identity |
|---|---|---|---|
| CLASSIC | DARK | `classic-dark` | Nền `#020210` purple-black, accent crimson, text light |
| CLASSIC | LIGHT | `classic-light` | Nền cool-blue tint (hue ~215°, B > R = G), accent crimson preserved (xem design.md §4.4) |
| LIGHT | (ignored) | `light` | Nền `#EDEDED` pure neutral grays, text dark |
| OLED | (ignored) | `oled` | Nền true black `#000000`, text light |

> `classic_mode` chỉ apply khi `theme=CLASSIC`. Nếu user toggle từ CLASSIC sang LIGHT/OLED, giá trị `classic_mode` được preserve trong settings (để khi quay lại CLASSIC vẫn nhớ preference) nhưng không ảnh hưởng `data-theme` rendered.

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-17-01 | Toggle Sáng/Tối chỉ hiển thị khi theme=CLASSIC |
| AC-17-02 | Chuyển theme → tất cả components update (no flash/reload) |
| AC-17-03 | Màu TTCK VN (trần/sàn/tăng/giảm/tham chiếu) giữ nguyên mọi theme — biến `--ssi-up/down/ref/ceil/floor/stable` declared trong cả 4 theme blocks |
| AC-17-08 | `classic-light` phải khác biệt rõ với `light` bằng mắt thường — minimum ΔE ~5-10 ở borders + surfaces (xem design.md §4.4 cho palette chốt) |
| AC-17-09 | Reload trang khi theme=`oled` hoặc `classic-dark` → KHÔNG flash trắng → đen. Anti-flash: inline boot script trong `<head>` đọc `localStorage.theme` + `localStorage.classic_mode` rồi set `data-theme` TRƯỚC khi React mount |
| AC-17-10 | Theme switcher đặt ở Header (góc trên phải) + replicate trong Settings page (cùng component logic) |
| AC-17-11 | Default lần đầu (chưa có localStorage): `theme=CLASSIC, classic_mode=DARK` → resolved `classic-dark` |

## UC-17-02: Switch Language (Phase 4)

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-17-04 | Language switcher (VIE\|ENG) đặt ở Header (góc trên phải) + replicate trong Settings page (cùng pattern với theme switcher — xem AC-17-10) |
| AC-17-05 | Chuyển ngôn ngữ → tất cả labels update, data giữ nguyên |
| AC-17-06 | Ngôn ngữ mặc định = VIE |
| AC-17-07 | Key missing → fallback VIE |
