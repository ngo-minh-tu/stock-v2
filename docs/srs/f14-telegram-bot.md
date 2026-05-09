---
name: SRS-14 Telegram Bot
description: Gửi run summary qua Telegram sau manual run, lỗi không block run, top_n từ Settings. Phase 3.
type: feature
module: SRS-14
prd_fr: FR-13
phase: 3
version: v1.4 LOCKED (cluster 6 reconciliation)
---

# F14 — Telegram Bot

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f01-core-screening-pipeline.md](f01-core-screening-pipeline.md) (Step 13), [f15-settings.md](f15-settings.md)
> Related — global: [g01](g01-global-errors-and-validation.md) (ERR-14-*)
> Related — tech: [TAD c07](../tad/c07-telegram.md), [TAD g02 §9](../tad/g02-api.md)

## Changelog

- **v1.4 (2026-05-09, cluster 6 reconciliation):** ➕ ADDED UC-14-02 Frontend TelegramSettings UI: toggle bật/tắt + 3 fields (token / chat_id / topN radio 3-or-5) + explicit save (KHÔNG debounce — vì validation `enabled+empty fields → 400` sẽ đẩy lỗi mỗi keystroke). TelegramTestButton mock ~70% success / ~30% fail (distinct toast). Inline error "Bật Telegram cần điền chat_id" khi save thiếu field. AC-14-05..08.

## UC-14-01: Send Run Summary via Telegram

### Preconditions
- Settings: telegram_enabled = true
- Settings: telegram_chat_id + telegram_token valid

### Trigger
Sau manual run hoàn thành (Step 13 trong UC-01-01)

### Message Template

```
🔍 VN RE AI Screener — Run {run_date}

📊 Kết quả: {buy_count} MUA | {hold_count} GIỮ | {sell_count} BÁN

🏆 Top {top_n} MUA:
1. {ticker1} — Score {score1} — ▲{upside1}% — {signal1}
2. {ticker2} — Score {score2} — ▲{upside2}% — {signal2}
3. {ticker3} — Score {score3} — ▲{upside3}% — {signal3}

⚠️ Cảnh báo: {warning_count} mã có risk flags

⚡ Xem chi tiết: {app_url}
```

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-14-01 | telegram_enabled = false → không gửi, không lỗi |
| AC-14-02 | Gửi thành công → telegram_sent = true |
| AC-14-03 | Telegram API lỗi → telegram_sent = false, telegram_error populated, run KHÔNG bị block |
| AC-14-04 | top_n = giá trị từ Settings (3 hoặc 5) |

### Error States

| Error ID | Condition | User Message |
|---|---|---|
| ERR-14-01 | API error | (silent to user) — telegram_sent=false, log |
| ERR-14-02 | Invalid chat_id/token | "Telegram chat_id hoặc token không hợp lệ" — show in Settings |

## UC-14-02: Frontend TelegramSettings UI (Cluster 6)

### Component Location

Settings page → CollapsibleSection "Telegram" (xem [f15 §UC-15-03](f15-settings.md)).

### Layout

```
┌─────────────────────────────────────────┐
│ ☐ Bật Telegram                          │  ← toggle
│                                          │
│ Token bot:    [____]                    │  ← visible khi enabled
│ Chat ID:      [____]                    │
│ Top N:        ◉ Top 3   ○ Top 5         │  ← radio
│                                          │
│ [Inline error nếu có]                   │
│                                          │
│ [Lưu cấu hình Telegram]  [Gửi tin thử]  │
└─────────────────────────────────────────┘
```

Khi toggle off → 3 fields hidden + save persist `telegram_enabled=false` ngay (KHÔNG cần điền field).

### Explicit Save (KHÔNG debounce)

**Decision:** Telegram fields save bằng button click explicit, KHÔNG auto-save mỗi keystroke.

**Rationale:** validation `enabled+empty fields → 400 ERR-14-02`. Nếu auto-save (debounce 500ms như threshold sliders) → mid-typing token user gõ "abc" → trigger save → server reject 400 vì chat_id còn empty → toast lỗi liên tục. Explicit save tránh false-positive lỗi.

**Note:** Theme/Language fields (cluster 1) auto-save (apply ngay khi click). Sources toggles (cluster 6) auto-save (discrete click). Threshold sliders debounce 500ms (continuous drag). Telegram = explicit save (multi-field interdependent + validation strict).

### Test Send

Button "Gửi tin thử" → POST `/api/telegram/test` → response:
- ~70% success → toast xanh "Đã gửi tin thử"
- ~30% fail → toast đỏ "Gửi tin thử thất bại — {error_message}"

Mock failure thực ra deterministic (xem [TAD c07 §4](../tad/c07-telegram.md)) — dùng `Math.random() < 0.3` per call để mô phỏng intermittent network.

### Validation Inline

Save button click → check rules:
- `telegram_enabled=true` + `telegram_chat_id===""` → inline error "Bật Telegram cần điền chat_id"
- `telegram_enabled=true` + `telegram_token===""` → inline error "Bật Telegram cần điền token"
- Server fallback validate cùng rules (ERR-14-02).

### Acceptance Criteria — Frontend

| AC ID | Criteria |
|---|---|
| AC-14-05 | Toggle bật → 3 fields hiện; toggle tắt → 3 fields ẩn + save `telegram_enabled=false` ngay |
| AC-14-06 | Save button click (KHÔNG keystroke debounce) → POST `/api/settings` với telegram_* fields → toast success/error |
| AC-14-07 | Toggle bật + chat_id rỗng → save fail với inline error "Bật Telegram cần điền chat_id" |
| AC-14-08 | Test send: ~70% success toast xanh, ~30% fail toast đỏ với error message; KHÔNG block save flow |
