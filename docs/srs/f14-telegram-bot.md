---
name: SRS-14 Telegram Bot
description: Gửi run summary qua Telegram sau manual run, lỗi không block run, top_n từ Settings. Phase 3.
type: feature
module: SRS-14
prd_fr: FR-13
phase: 3
---

# F14 — Telegram Bot

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f01-core-screening-pipeline.md](f01-core-screening-pipeline.md) (Step 13), [f15-settings.md](f15-settings.md)
> Related — global: [g01](g01-global-errors-and-validation.md) (ERR-14-*)

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
