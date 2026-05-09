---
name: SRS-15 Settings
description: View/Update settings — 6 collapsible sections (Theme/Language giao diện, MockOutcome dev, Sources, Telegram, Thresholds, Password) + ShareLinksManagement. settings_version audit. Phase 3 + 4.
type: feature
module: SRS-15
prd_fr: FR-14
phase: 3 + 4
version: v1.4 LOCKED (cluster 6 reconciliation)
---

# F15 — Settings

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f10-news-sentiment.md](f10-news-sentiment.md), [f13-export-share.md](f13-export-share.md) (ShareLinksManagement), [f14-telegram-bot.md](f14-telegram-bot.md), [f16-authentication.md](f16-authentication.md), [f17-theme-i18n.md](f17-theme-i18n.md)
> Related — global: [g01](g01-global-errors-and-validation.md) (validation rules), [g03](g03-appendix-enums-constants.md) (NewsSource, Theme, ClassicMode, Language, DEFAULT_*_THRESHOLD)

## Changelog

- **v1.2 (2026-05-09, cluster 1 reconciliation):** ➕ Bổ sung UC-15-02 (Settings Page UI progressive disclosure) — Settings render theo từng phase: cluster 1 chỉ có Theme + Language sections; sections sources/telegram/threshold/password defer sang cluster 6. AC-15-05/06 mới. ➕ Schema thêm 2 field audit metadata (`settings_version: int`, `updated_at: ISO 8601`).
- **v1.3 (2026-05-09, cluster 2 reconciliation):** ➕ Bổ sung Mock Outcome section (prototype-only dev tool) + Coming Soon card placeholder. ❌ AC-15-05 cũ "không placeholder" → ✅ REPLACED — cluster 2 prototype có Coming Soon card.
- **v1.4 (2026-05-09, cluster 6 reconciliation):** ✅ All 6 production sections **đã ship**. ❌ REMOVED Coming Soon card placeholder (cluster 2 stop-gap, no longer needed). ❌ REMOVED progressive disclosure phasing notes — sections không còn defer. ➕ ADDED UC-15-03 CollapsibleSection (localStorage state per section). UC-15-04 ThresholdSliders (debounce 500ms + cross-validation buy>hold + preview line). UC-15-05 NewsSourcesToggles auto-save (no debounce). UC-15-06 PasswordChangeForm (3 inputs + persist new token + skip AuthContext setter). UC-15-07 validateSettingsPatch effective-state pattern (build merged state before cross-field check). AC-15-07..15.

## UC-15-01: View/Update Settings (Backend Schema)

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
| telegram_top_n | MUST in [3, 5] |
| theme | MUST in {CLASSIC, LIGHT, OLED} |
| classic_mode | MUST in {DARK, LIGHT} |
| language | MUST in {VIE, ENG} |
| password_hash | MUST not store plaintext |

### Acceptance Criteria — Backend

| AC ID | Criteria |
|---|---|
| AC-15-01 | buy_threshold ≤ hold_min_threshold → validation error |
| AC-15-02 | Telegram enabled + empty chat_id → validation error |
| AC-15-03 | Settings save → settings_version tăng (dùng cho audit) |
| AC-15-04 | Theme change → UI update ngay lập tức không cần reload |

## UC-15-02: Settings Page UI Layout (Cluster 6 Final)

Settings page là single page render 6 production sections (collapsible) + 1 prototype-only dev section + 1 management table.

### Render Order

| # | Section | Type | Cluster ownership | Component |
|---|---|---|---|---|
| 1 | Giao diện (Theme + Language picker + Mock Outcome) | Composite | cluster 1 + 2 | `<ThemePicker />` + `<LanguagePicker />` + `<MockOutcomePicker />` |
| 2 | Ngưỡng khuyến nghị | Collapsible | cluster 6 | `<ThresholdSliders />` |
| 3 | Nguồn tin | Collapsible | cluster 6 | `<NewsSourcesToggles />` |
| 4 | Telegram | Collapsible | cluster 6 | `<TelegramSettings />` |
| 5 | Bảo mật (đổi mật khẩu) | Collapsible | cluster 6 | `<PasswordChangeForm />` |
| 6 | Quản lý chia sẻ | Collapsible | cluster 6 | `<ShareLinksManagement />` (xem [f13 §UC-13-03](f13-export-share.md)) |

> **MockOutcomePicker** (cluster 2) là prototype-only dev tool — KHÔNG ship MVP. MVP frontend strip section này khi build (env-flag check). Lý do: cho dev/QA force test 4 outcome (success/warnings/failed/conflict) của run flow.

### Apply Behavior — per section type

| Section | Save mode | Debounce | Reason |
|---|---|---|---|
| Theme + Language | Auto-save apply ngay | None | Visual feedback tức thì cần |
| News Sources | Auto-save mỗi click | None | Discrete click, validation trivial |
| Threshold Sliders | Auto-save | **500ms debounce** | Continuous drag → tránh save spam |
| Telegram | **Explicit save (button click)** | None | Validation strict (enabled+empty → 400) — keystroke save → toast lỗi liên tục |
| Password | Explicit save (button click) | None | Multi-field validation + match check; persist new token |

### Acceptance Criteria — Frontend Layout

| AC ID | Criteria |
|---|---|
| AC-15-05 | Settings render 6 sections theo render order; mỗi section là 1 unit độc lập (apply/save tại chỗ, KHÔNG có nút Save tổng) |
| AC-15-06 | MockOutcomePicker (prototype-only) render trong section Giao diện; MVP build strip qua env-flag check |
| AC-15-07 | Save mode + debounce per section type theo bảng "Apply Behavior" — cụ thể Telegram phải explicit save (NOT debounce) |

## UC-15-03: CollapsibleSection (Cluster 6)

Pattern wrapper cho mỗi section (sections 2-6). Section 1 (Giao diện) KHÔNG collapsible vì là always-visible top section.

### Component Spec

```tsx
<CollapsibleSection
  id="telegram"
  title="Telegram"
  defaultOpen={false}
>
  <TelegramSettings />
</CollapsibleSection>
```

### Behavior

| Aspect | Spec |
|---|---|
| Header | Click anywhere on header → toggle expand/collapse |
| Chevron icon | `<ChevronRight>` rotate 90° khi expanded; rotate 0° khi collapsed (CSS transition 200ms) |
| State persist | localStorage key `settings.section.{id}` value `"open"` / `"closed"` |
| Default | `defaultOpen` prop (mỗi section quyết định) — falls back to `false` nếu localStorage chưa có |
| F5 reload | Section open state restore từ localStorage |

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-15-08 | Click section header → toggle expand/collapse với chevron rotate animation |
| AC-15-09 | Section open/close state persist qua F5 (localStorage `settings.section.{id}`) |
| AC-15-10 | Section đầu tiên load tuân theo `defaultOpen` prop nếu localStorage rỗng |

## UC-15-04: ThresholdSliders (Cluster 6)

### Layout

```
┌────────────────────────────────────────┐
│ Ngưỡng MUA: [────────●────] 75          │  ← range slider 50-95
│                                          │
│ Ngưỡng GIỮ: [─────●───────] 45          │  ← range slider 20-74
│                                          │
│ [Visual line preview]                   │
│   0─────────────────────────────────100│
│         GIỮ▼          MUA▼              │
│                                          │
│ [Inline error nếu MUA ≤ GIỮ]            │
└────────────────────────────────────────┘
```

### Behavior

- 2 range slider HTML5 `<input type="range">`.
- **Cross-field validation:** MUST `buy_threshold > hold_min_threshold`. Validate client-side khi user kéo; nếu invalid → inline error "Ngưỡng MUA phải lớn hơn ngưỡng GIỮ" + skip save (không fire PUT).
- **Debounce 500ms** qua `setTimeout` + cleanup; `lastSavedRef` tránh save trùng giá trị.
- **Preview line** update real-time (KHÔNG debounce — visual feedback tức thì).
- Save thành công → toast "Đã lưu ngưỡng".

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-15-11 | Kéo slider → preview line update real-time; sau 500ms idle → fire PUT /api/settings + toast |
| AC-15-12 | Kéo MUA ≤ GIỮ → inline error đỏ "Ngưỡng MUA phải lớn hơn ngưỡng GIỮ" + KHÔNG fire save |

## UC-15-05: NewsSourcesToggles (Cluster 6)

5 toggle (CafeF / VnExpress / Vietstock / Batdongsan / ThanhNien). Auto-save mỗi click (no debounce — discrete event).

Click toggle → flip boolean → fire PUT /api/settings → toast "Đã cập nhật nguồn tin · {SourceName}".

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-15-13 | Click toggle → flip + auto-save (no debounce); toast với tên source vừa thay đổi |

## UC-15-06: PasswordChangeForm (Cluster 6)

### Layout

```
┌────────────────────────────────────────┐
│ Mật khẩu hiện tại:    [____________]   │
│ Mật khẩu mới:          [____________]   │
│ Xác nhận mật khẩu:     [____________]   │
│                                          │
│ [Inline error nếu có]                   │
│                                          │
│             [Đổi mật khẩu]              │
└────────────────────────────────────────┘
```

### Validation (3 client-side rules)

| Rule | Trigger | Message |
|---|---|---|
| 1. New password ≥8 chars | <8 | "Mật khẩu mới phải có ít nhất 8 ký tự" |
| 2. New === Confirm | mismatch | "Mật khẩu xác nhận không khớp" |
| 3. Current required | empty | "Vui lòng nhập mật khẩu hiện tại" |

Server fallback: validate current password match user_profile.password_hash bcrypt.

### Behavior

1. User submit → validate client → submit PUT `/api/auth/password` body `{current, new}`.
2. Server validate → bcrypt verify current → hash new → return `{token: new_jwt}` (cluster 6 mock; production cùng pattern).
3. Frontend: `localStorage.setItem('token', newToken)` (skip `AuthContext.setToken` setter để tránh phụ thuộc API mới).
4. `apiFetch` reads `localStorage.token` mỗi request → token mới được dùng tự động (không cần re-mount `<AuthContext>`).
5. Form clear + toast "Đã đổi mật khẩu".

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-15-14 | 3 validation rules trigger inline error đúng; submit fail → form không clear |
| AC-15-15 | Submit success → server return new token → localStorage update → form clear → toast; subsequent API calls dùng token mới (không cần re-login) |

## UC-15-07: validateSettingsPatch — Effective State Pattern (Cluster 6)

### Problem

PUT `/api/settings` accepts **partial patch** (single-field hoặc multi-field). Cross-field rules (`buy_threshold > hold_min_threshold`, `telegram_enabled → chat_id+token required`) cần check trên **effective state** (current state ⊕ patch), KHÔNG trên patch alone.

**Example bug nếu validate patch alone:**
- Current: `{telegram_enabled: true, telegram_chat_id: "abc", telegram_token: "xyz"}`
- Patch: `{language: 'ENG'}` — single field, không touch telegram
- Validate patch alone → patch không có telegram_enabled → buộc fail "telegram needs chat_id+token"? Sai.

### Pattern

```ts
function validateSettingsPatch(
  current: Settings,
  patch: Partial<Settings>
): ValidationError | null {
  const next: Settings = { ...current, ...patch };  // merged effective state

  // Cross-field rules check on `next`, not `patch`
  if (next.buy_threshold <= next.hold_min_threshold) {
    return { code: 'ERR-15-01', message: '...' };
  }
  if (next.telegram_enabled && !next.telegram_chat_id) {
    return { code: 'ERR-15-02', message: '...' };
  }
  // ... enum checks (theme, language, etc.)

  return null;
}
```

Race-free: even single-field PUT (`{language: 'ENG'}`) validate đúng cross-field rules dựa trên state hiện tại.

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-15-16 | Single-field PUT (vd `{language: 'ENG'}`) PASS validate ngay cả khi telegram_enabled=true (cross-field check không spurious fail) |
| AC-15-17 | Multi-field PUT với conflict (vd `{buy_threshold: 40, hold_min_threshold: 50}`) FAIL với cross-field error |
