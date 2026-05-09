---
id: c07
title: Telegram Integration
parent: 00-tad-system-overview.md
type: component
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§17); cluster 6 reconciliation 2026-05-09
version: v1.4 LOCKED (cluster 6 reconciliation)
---

# c07 — Telegram Integration

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)
>
> Implements: [../srs/f14-telegram-bot.md](../srs/f14-telegram-bot.md)
>
> Related — global: [g01-runtime.md](g01-runtime.md) (Telegram error → `COMPLETED_WITH_WARNINGS`, non-blocking), [g05-cross-cutting.md](g05-cross-cutting.md) (logs `telegram_error`), [g07-deployment.md](g07-deployment.md) (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_TIMEOUT_SECONDS` env vars)

## Changelog

- **v1.4 (2026-05-09, cluster 6 reconciliation):** ❌ REMOVED 1-line stub §1 → ✅ REPLACED bằng full architecture: §1 Backend Behavior (giữ + clarify), §2 Frontend Components (TelegramSettings + TelegramTestButton), §3 Explicit Save Pattern Rationale, §4 Mock Test Handler (~70%/30%).

---

## 1. Backend Behavior

Non-blocking. After manual run COMPLETED. Gửi summary qua Telegram Bot API: counts (buy/hold/sell) + Top N (3 hoặc 5).

### 1.1 Settings Dependencies

| Setting | Effect |
|---|---|
| `telegram_enabled = false` | Skip send entirely (no error, no log) |
| `telegram_chat_id` empty + enabled | Validation 400 ERR-14-02 (xem c08 validateSettingsPatch in [f15 §UC-15-07](../srs/f15-settings.md)) |
| `telegram_token` empty + enabled | Validation 400 ERR-14-02 |
| `telegram_top_n` ∈ {3, 5} | Top N mã trong message |

### 1.2 Error Handling

Telegram API error → log `telegram_error` (xem [g05 §logging](g05-cross-cutting.md)), set `telegram_sent=false`, run **KHÔNG bị block** (vẫn COMPLETED hoặc COMPLETED_WITH_WARNINGS).

---

## 2. Frontend Components (Cluster 6)

### 2.1 `<TelegramSettings />`

Layout (xem [f14 §UC-14-02](../srs/f14-telegram-bot.md)):

```
☐ Bật Telegram                    ← toggle
Token bot:    [____]              ← visible khi enabled
Chat ID:      [____]
Top N:        ◉ Top 3   ○ Top 5

[Inline error nếu có]

[Lưu cấu hình Telegram]  [Gửi tin thử]
```

**State:** local component state (token, chat_id, top_n, enabled). Sync với `/api/settings` GET on mount.

### 2.2 `<TelegramTestButton />`

POST `/api/telegram/test` → distinct toast:
- ~70% success → `toast.success("Đã gửi tin thử")`
- ~30% fail → `toast.error("Gửi tin thử thất bại — {error_message}")`

Mock implementation: `Math.random() < 0.3` per call. Dev/QA bấm 3-4 lần để thấy cả 2 outcomes.

---

## 3. Explicit Save Pattern Rationale

Telegram fields KHÔNG dùng debounce auto-save (như threshold sliders 500ms), mà dùng **explicit save (button click)**.

**Lý do:** validation `enabled+empty fields → 400 ERR-14-02`. Nếu auto-save:

```
User flow auto-save (HỎNG):
1. Toggle bật → fire save → server reject 400 (chat_id empty)
2. User gõ "abc" trong token field → fire save → reject 400 (chat_id vẫn empty)
3. User gõ "1234" trong chat_id → fire save → có thể OK
... toast lỗi liên tục mid-typing
```

```
User flow explicit save (OK):
1. Toggle bật → fields hiện
2. User điền cả 3 fields
3. Click "Lưu cấu hình Telegram" → fire save → success
... toast 1 lần duy nhất
```

So sánh save mode trên Settings (xem [f15 §UC-15-02](../srs/f15-settings.md) "Apply Behavior"):

| Section | Save mode | Reason |
|---|---|---|
| Theme + Language | Auto-save apply ngay | Visual feedback cần tức thì |
| News Sources | Auto-save mỗi click | Discrete, validation trivial |
| Threshold Sliders | Auto-save 500ms debounce | Continuous drag, validation simple |
| **Telegram** | **Explicit save** | Multi-field interdependent + validation strict |
| Password | Explicit save | Multi-field validation + match + persist token |

---

## 4. Mock Test Handler

```ts
// MSW handler: POST /api/telegram/test
http.post('/api/telegram/test', () => {
  const success = Math.random() >= 0.3;     // ~70% success
  if (success) {
    return HttpResponse.json({
      success: true,
      data: { sent: true, error: null }
    });
  }
  const errorMessages = [
    'Telegram API timeout',
    'Bot token invalid',
    'Chat not found',
  ];
  return HttpResponse.json({
    success: true,                            // envelope success — error in data
    data: {
      sent: false,
      error: errorMessages[Math.floor(Math.random() * 3)]
    }
  });
});
```

**Note:** envelope `{success: true, data: {sent, error}}` (KHÔNG `success: false`). Lý do: HTTP success (200) — Telegram error là application-level state, frontend handle qua `data.sent` flag.

---

## 5. Backend Production Phase

Replace mock handler bằng FastAPI endpoint:
- Read `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` env vars
- Call Telegram Bot API `sendMessage`
- Timeout `TELEGRAM_TIMEOUT_SECONDS` env var
- On error: log + return `{sent: false, error: <msg>}`

Frontend KHÔNG cần đổi — endpoint shape + envelope giữ nguyên.
