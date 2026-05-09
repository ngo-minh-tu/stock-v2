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

- **v1.2 (2026-05-09, cluster 1 reconciliation):** ➕ Bổ sung UC-15-02 (Settings Page UI progressive disclosure) — Settings render theo từng phase: cluster 1 chỉ có Theme + Language sections; sections sources/telegram/threshold/password defer sang cluster 6. AC-15-05/06 mới. ➕ Schema thêm 2 field audit metadata (`settings_version: int`, `updated_at: ISO 8601`) khớp với prototype `mocks/data/settings.ts` (AC-15-03 đã đề cập `settings_version` nhưng schema cũ không list).
- **v1.3 (2026-05-09, cluster 2 reconciliation):** ➕ Bổ sung Mock Outcome section (prototype-only dev tool, cluster 2 ownership) + Coming Soon card placeholder. ❌ AC-15-05 cũ "không placeholder Coming soon trong production UI" → ✅ REPLACED — cluster 2 prototype có Coming Soon card, spec phải reflect prototype đã duyệt. Production hide hẳn vs Coming Soon là UX choice của mỗi cluster, không cấm tuyệt đối.

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
  password_hash: string,

  // Audit metadata (managed by backend, không user-editable)
  settings_version: int (auto-increment mỗi lần PATCH thành công, dùng cho audit + cache invalidation),
  updated_at: ISO 8601 datetime string (UTC)
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
| AC-15-05 | Settings page render: section đã ship hiển thị đầy đủ; section chưa ship → có thể hide hẳn HOẶC dùng "Coming Soon" placeholder card (mỗi cluster quyết định theo UX của cluster đó). Cluster 1 hide hẳn; cluster 2 thêm Coming Soon card cho roadmap visibility |
| AC-15-06 | Mỗi section là 1 unit độc lập (theme picker / language picker / sources / telegram / thresholds / password) — apply/save tại chỗ, không có nút Save tổng |

## UC-15-02: Settings Page UI — Progressive Disclosure (Phase 2-4)

Settings page là single page render danh sách section theo thứ tự cố định. Mỗi cluster ship thêm section của mình; sections chưa ship không render.

### Render order + phase ownership

| # | Section | Phase | Cluster ownership | Component |
|---|---|---|---|---|
| 1 | Theme picker (4 radio cards: Classic Dark / Classic Light / Light / OLED) | 4 | cluster 1 | `<ThemePicker />` |
| 2 | Language picker (VIE / ENG radio) | 4 | cluster 1 | `<LanguagePicker />` |
| 3 | **Mock Outcome (PROTOTYPE-ONLY)** — segmented buttons `success / warnings / failed / conflict` | — | cluster 2 | `<MockOutcomePicker />` |
| 4 | News sources (5 toggles: cafef / vnexpress / vietstock / batdongsan / thanhnien) | 3 | cluster 6 | `<SourcesPicker />` |
| 5 | Telegram (enable + chat_id + token + top_n) | 3 | cluster 6 | `<TelegramSection />` |
| 6 | Thresholds (buy_threshold + hold_min_threshold + default_capital) | 3 | cluster 6 | `<ThresholdsSection />` |
| 7 | Password change (old + new + confirm) | 2 | cluster 6 | `<PasswordSection />` |
| 8 | **Coming Soon card** (Construction icon, label "Còn các mục cluster 6 sẽ thêm") | — | cluster 2 (placeholder) | inline trong settings page |

> [v1.3] **Mock Outcome** section là prototype-only dev tool — KHÔNG ship MVP. MVP frontend strip section này khi build. Lý do: cho dev/QA force test 4 outcome (success/warnings/failed/conflict) của run flow mà không cần manipulate runs-store thủ công.

> [v1.3] **Coming Soon card** là placeholder trong prototype để PO thấy "section gì sẽ ship cluster 6". Production MVP có 2 lựa chọn: (a) hide hẳn (như AC-15-05 nguyên gốc nói), hoặc (b) giữ Coming Soon nếu muốn show roadmap. **Quyết định**: theo prototype đã duyệt → giữ Coming Soon card trong production MVP đến khi cluster 6 ship đủ section, lúc đó replace bằng section thật.

### Apply behavior

- **Theme + Language:** apply ngay khi user click (không cần Save) + persist localStorage + fire-and-forget `PUT /api/settings`. Lý do: visual change cần feedback tức thì.
- **Sources / Telegram / Thresholds / Password:** save khi click button trong section, gọi `PUT /api/settings` (hoặc `PUT /auth/password` cho password) + show toast success/error.
