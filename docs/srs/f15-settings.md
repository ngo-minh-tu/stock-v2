---
name: SRS-15 Settings
description: View/Update settings: thresholds, capital, news sources, Telegram, theme, language, password. Có settings_version để audit. Phase 3 + 4.
type: feature
module: SRS-15
prd_fr: FR-14
phase: 3 + 4
version: v1.1 LOCKED (post-prototype reconciliation)
---

# F15 — Settings

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f10-news-sentiment.md](f10-news-sentiment.md), [f14-telegram-bot.md](f14-telegram-bot.md), [f16-authentication.md](f16-authentication.md), [f17-theme-i18n.md](f17-theme-i18n.md)
> Related — global: [g01](g01-global-errors-and-validation.md) (validation rules), [g03](g03-appendix-enums-constants.md) (NewsSource, Theme, ClassicMode, Language, DEFAULT_*_THRESHOLD)

## Changelog

- **v1.2 (2026-05-09, cluster 1 reconciliation):** Bổ sung UC-15-02 (Settings Page UI progressive disclosure) — Settings render theo từng phase: cluster 1 chỉ có Theme + Language sections; sections sources/telegram/threshold/password defer sang cluster 6. AC-15-05/06 mới.

## UC-15-01: View/Update Settings

### Settings Schema

```
{
  // Thresholds
  buy_threshold: int (default 75, range 50-95),
  hold_min_threshold: int (default 45, range 20-74),

  // Capital
  default_capital: int (default 0, ≥ 0),

  // News sources
  source_cafef: boolean (default true),
  source_vnexpress: boolean (default true),
  source_vietstock: boolean (default true),
  source_batdongsan: boolean (default true),
  source_thanhnien: boolean (default true),

  // Telegram
  telegram_enabled: boolean (default false),
  telegram_chat_id: string (default ""),
  telegram_token: string (default ""),
  telegram_top_n: int (default 3, enum [3, 5]),

  // Theme (Phase 4)
  theme: enum(CLASSIC | LIGHT | OLED) (default CLASSIC),
  classic_mode: enum(DARK | LIGHT) (default DARK),

  // Language (Phase 4)
  language: enum(VIE | ENG) (default VIE),

  // Auth
  password_hash: string
}
```

### Validation Rules

| Field | Rule |
|---|---|
| buy_threshold | MUST > hold_min_threshold |
| hold_min_threshold | MUST < buy_threshold |
| telegram_chat_id | Nếu telegram_enabled → MUST not empty |
| telegram_token | Nếu telegram_enabled → MUST not empty |
| password_hash | MUST not store plaintext |

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-15-01 | buy_threshold ≤ hold_min_threshold → validation error |
| AC-15-02 | Telegram enabled + empty chat_id → validation error |
| AC-15-03 | Settings save → settings_version tăng (dùng cho audit) |
| AC-15-04 | Theme change → UI update ngay lập tức không cần reload |
| AC-15-05 | Settings page render theo phase: chỉ section thuộc phase đã ship mới hiển thị; section của phase sau hoàn toàn ẩn (không placeholder "Coming soon" trong production UI) |
| AC-15-06 | Mỗi section là 1 unit độc lập (theme picker / language picker / sources / telegram / thresholds / password) — apply/save tại chỗ, không có nút Save tổng |

## UC-15-02: Settings Page UI — Progressive Disclosure (Phase 2-4)

Settings page là single page render danh sách section theo thứ tự cố định. Mỗi cluster ship thêm section của mình; sections chưa ship không render.

### Render order + phase ownership

| # | Section | Phase | Cluster ownership | Component |
|---|---|---|---|---|
| 1 | Theme picker (4 radio cards: Classic Dark / Classic Light / Light / OLED) | 4 | cluster 1 | `<ThemePicker />` |
| 2 | Language picker (VIE / ENG radio) | 4 | cluster 1 | `<LanguagePicker />` |
| 3 | News sources (5 toggles: cafef / vnexpress / vietstock / batdongsan / thanhnien) | 3 | cluster 6 | `<SourcesPicker />` |
| 4 | Telegram (enable + chat_id + token + top_n) | 3 | cluster 6 | `<TelegramSection />` |
| 5 | Thresholds (buy_threshold + hold_min_threshold + default_capital) | 3 | cluster 6 | `<ThresholdsSection />` |
| 6 | Password change (old + new + confirm) | 2 | cluster 6 | `<PasswordSection />` |

### Apply behavior

- **Theme + Language:** apply ngay khi user click (không cần Save) + persist localStorage + fire-and-forget `PUT /api/settings`. Lý do: visual change cần feedback tức thì.
- **Sources / Telegram / Thresholds / Password:** save khi click button trong section, gọi `PUT /api/settings` (hoặc `PUT /auth/password` cho password) + show toast success/error.
