---
id: c07
title: Telegram Integration
parent: 00-tad-system-overview.md
type: component
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§17)
---

# c07 — Telegram Integration

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)
>
> Implements: [../srs/f14-telegram-bot.md](../srs/f14-telegram-bot.md)
>
> Related — global: [g01-runtime.md](g01-runtime.md) (Telegram error → `COMPLETED_WITH_WARNINGS`, non-blocking), [g05-cross-cutting.md](g05-cross-cutting.md) (logs `telegram_error`), [g07-deployment.md](g07-deployment.md) (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_TIMEOUT_SECONDS` env vars)

---

## 1. Behavior

Non-blocking. After manual run COMPLETED. Gửi summary: counts + Top N. Settings: bật/tắt + Top 3 or 5 + chat_id + token. Error → log, run không bị block.
