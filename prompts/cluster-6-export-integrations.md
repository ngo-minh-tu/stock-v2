# PROMPT — CỤM 6: Export & Integrations (PDF + Share + Telegram + Settings Full)

> **Prototype UI/UX** trong `/Users/ngominhtu/Projects/stock-v2/prototype/` — đây là prototype để test UX, KHÔNG implement business logic thực. Mọi data từ MSW mocks.
>
> Build trên Cụm 1-5. Đây là cụm **cuối cùng** — Settings page hoàn thiện đầy đủ ở đây.

---

## 0. Context — Đọc trước khi code

1. Code Cụm 1-5 trong `prototype/`
2. `docs/PRD_v0.5A_Final_Locked.md` §7.12 (Export & Share), §7.13 (Telegram), §7.14 (Settings full)
3. `tad/g02-api.md` — `/export/pdf`, `/share`, `/telegram/test`, `/settings`
4. `tad/g03-database.md` Tables 12 (settings), 15 (share_links)
5. `tad/c06-pdf-share.md`
6. `tad/c07-telegram.md`
7. `srs/f13-export-share.md`, `srs/f14-telegram-bot.md`, `srs/f15-settings.md`

---

## 1. Mục tiêu cụm

Test UX cho 3 integrations + finalize Settings:
- **PDF Export**: trigger từ Dashboard / Top MUA / Run Detail → download
- **Share Link**: tạo link 7-day expire với token, copy URL
- **Telegram**: test send + bật/tắt + Top N config
- **Settings full**: 5 sections (đã có theme/language Cụm 1, thêm 4 sections mới)

---

## 2. Tech additions

Không thêm thư viện. Có thể dùng `react-hot-toast` (đã có Cụm 2) cho copy URL.

---

## 3. PDF Export

### 3.1 Trigger UX (3 entry points)

- **Dashboard**: button "Xuất PDF" góc phải (cạnh Run selector)
- **Top MUA**: button "Xuất PDF Top MUA"
- **Run History row action**: icon "Download PDF"

### 3.2 Flow

1. Click → check `run_id` có data
2. GET `/api/export/pdf/{run_id}` (binary)
3. Browser download trigger qua `<a download>` blob URL
4. Toast success "Đã tải PDF"
5. Loading state trên button trong lúc fetch (~1-2s mock)

### 3.3 PDF preview (optional)

Modal preview trước khi download — chỉ hiển thị HTML version (không render PDF thật trong browser):
- Header: brand + tagline + run_at
- Summary KPIs
- Table Top MUA (top 10)
- Table Red Flags
- Disclaimer

→ Button "Download" trong modal để confirm.

PDF MVP **text/table only** — không charts (theo TAD c06).

---

## 4. Share Link

### 4.1 Trigger UX

Button "Chia sẻ" cạnh "Xuất PDF" trên Dashboard / Top MUA.

### 4.2 Modal flow

Click → open modal:
1. Loading state trong khi POST /api/share { run_id, expires_in_days: 7 }
2. Response: `{ token, url, expires_at }`
3. Hiển thị:
   - Big input readonly với URL: `https://app.example/share/{token}`
   - Copy button → clipboard + toast
   - "Hết hạn: 7 ngày sau" với countdown
   - Note: "Link cần Basic Auth (mật khẩu hệ thống) để xem"
4. Button "Tạo link mới" → POST lại
5. Button "Đóng"

### 4.3 Shared view page (`/share/{token}`)

Public route (không cần auth context của app):
1. GET `/api/share/{token}` (mock validates token + check expires_at)
2. Nếu valid → render read-only view:
   - Mini header: brand + "Shared by {name} on {date}" + countdown expire
   - Dashboard 6 visuals (read-only, không có Run selector)
   - Top MUA bảng (read-only, không expand action)
   - Disclaimer
   - Watermark "READ-ONLY SHARED VIEW"
3. Nếu expired/invalid → 404 page với message

### 4.4 Settings: Active share links list

Section trong Settings → list link đang active:
| Token | Run ID | Created at | Expires at | Action (revoke) |

---

## 5. Telegram

### 5.1 Settings section

Card "Telegram" với:
- Toggle Bật/Tắt
- Conditional fields (chỉ show khi bật):
  - Bot Token (text input password type) + show/hide button
  - Chat ID (text input)
  - Top N (radio: 3 or 5)
  - Test send button

### 5.2 Test send flow

Click "Gửi tin thử" → POST /api/telegram/test:
- Loading state trong button
- Response: `{ sent: true, error: null }` → toast green "Đã gửi tin thử"
- Response: `{ sent: false, error: "Bot token invalid" }` → toast red với error
- Mock 70% success rate (random) để test cả 2 paths

### 5.3 Visual reference

Không cần preview text Telegram trong UX, chỉ note:
- "Tin sẽ được gửi sau mỗi lần Chạy thành công"
- "Định dạng: counts MUA/GIỮ/BÁN + Top {N} mã MUA"

---

## 6. Settings page — full layout

### 6.1 Layout

Single-page với 6 sections (collapsible cards):

1. **Giao diện** (Theme + Language) — đã có Cụm 1
2. **Ngưỡng khuyến nghị** — sliders
3. **Nguồn tin** — 5 toggles
4. **Telegram** — đã ghi §5
5. **Bảo mật** — đổi mật khẩu
6. **Quản lý chia sẻ** — share links list (§4.4)

### 6.2 Section "Ngưỡng khuyến nghị"

- Slider "MUA tối thiểu": 50-95 (default 75) — màu green track
- Slider "GIỮ tối thiểu": 20-70 (default 45) — màu yellow track
- Validate: buy_threshold > hold_min_threshold
- Preview: "Hiện tại: ≥75 MUA | 45-74 GIỮ | <45 BÁN"
- Save button → PUT /api/settings → toast

### 6.3 Section "Nguồn tin"

5 toggle rows:
- ☑️ CafeF | ☑️ VnExpress | ☑️ Vietstock | ☑️ Batdongsan | ☑️ Thanh Niên

Submit on change → PUT /api/settings.

### 6.4 Section "Bảo mật"

Form đổi mật khẩu:
- Mật khẩu hiện tại (required)
- Mật khẩu mới (min 8 chars, hint)
- Xác nhận mật khẩu mới (must match)
- Submit → PUT /api/auth/password → toast + force re-login

### 6.5 Save behavior

- **Auto save**: theme, language, sources toggles, threshold sliders (debounce 500ms)
- **Explicit save**: telegram (test trước khi save), password
- Toast confirmation cho mỗi save thành công

---

## 7. Mock API (MSW handlers thêm/update)

### 7.1 Export

```
GET /api/export/pdf/{run_id}
```

Mock: trả Blob của HTML file (giả lập PDF) với headers `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="run-{id}.pdf"`. Body = HTML rendered với mock data.

### 7.2 Share

```
POST /api/share { run_id, expires_in_days }
GET  /api/share/{token}      → return run results read-only
DELETE /api/share/{token}    → revoke (settings management)
GET  /api/share              → list active share links (settings)
```

In-memory share_links store. Token = uuid v4 mock.

### 7.3 Telegram

```
POST /api/telegram/test
```

Random 70% return `{ sent: true }`, 30% `{ sent: false, error: "Bot token invalid" }`.

### 7.4 Settings full

`GET /api/settings` đã có Cụm 1 — extend response với toàn bộ TAD g03 Table 12 fields:

```json
{
  "buy_threshold": 75,
  "hold_min_threshold": 45,
  "default_capital": 0,
  "source_cafef": true,
  "source_vnexpress": true,
  "source_vietstock": true,
  "source_batdongsan": true,
  "source_thanhnien": true,
  "telegram_enabled": false,
  "telegram_chat_id": "",
  "telegram_token": "",
  "telegram_top_n": 3,
  "theme": "CLASSIC",
  "classic_mode": "DARK",
  "language": "VIE"
}
```

`PUT /api/settings` accept partial updates. Validation:
- `buy_threshold > hold_min_threshold`: 400 với error envelope
- `telegram_top_n in [3, 5]`
- `theme in [CLASSIC, LIGHT, OLED]`
- `classic_mode in [DARK, LIGHT]`
- `language in [VIE, ENG]`

### 7.5 Auth password

```
PUT /api/auth/password { current_password, new_password }
```

Mock: any current_password works (single-user MVP), 200 success → token mới.

---

## 8. Components mới

```
src/components/
├── export/
│   ├── ExportPdfButton.tsx
│   └── PdfPreviewModal.tsx
├── share/
│   ├── ShareButton.tsx
│   ├── ShareLinkModal.tsx
│   └── SharedView.tsx              # public /share/{token} page
├── telegram/
│   ├── TelegramSettings.tsx
│   └── TelegramTestButton.tsx
└── settings/
    ├── ThresholdSliders.tsx
    ├── NewsSourcesToggles.tsx
    ├── PasswordChangeForm.tsx
    └── ShareLinksManagement.tsx
```

Hooks: `useExportPdf`, `useShareLink`, `useTelegramTest`, `useSettingsFull`.

Routes:
- `/share/[token]/page.tsx` — public, không cần ProtectedRoute

---

## 9. i18n keys thêm

- `export.button` / `.loading` / `.success` / `.preview.title` / `.preview.download`
- `share.button` / `.modal.title` / `.url.label` / `.copy.success` / `.expires` / `.regenerate` / `.note.basicAuth`
- `share.view.header` / `.watermark` / `.invalid` / `.expired`
- `telegram.toggle` / `.botToken` / `.chatId` / `.topN.3` / `.topN.5` / `.testButton` / `.test.success` / `.test.error`
- `telegram.info.runComplete` / `.format`
- `settings.section.appearance` / `.threshold` / `.sources` / `.telegram` / `.security` / `.share`
- `settings.threshold.buy` / `.hold` / `.preview` / `.error.invalid`
- `settings.password.current` / `.new` / `.confirm` / `.error.mismatch` / `.success`
- `settings.share.management.empty` / `.revoke.confirm`

---

## 10. Acceptance criteria

1. Click "Xuất PDF" trên 3 entry points → file download (HTML mock as PDF)
2. PDF preview modal render đủ sections (header, KPIs, top MUA, red flags, disclaimer)
3. Share modal: tạo link → copy URL → clipboard chứa URL đúng
4. Open `/share/{token}` trong tab mới → render read-only view với watermark
5. Token invalid/expired → 404 page
6. Settings → revoke share link → confirm → token bị xóa, public view trả 404
7. Telegram: bật toggle → fields show, fill rồi test send → 70% success / 30% error UX
8. Threshold sliders: validate buy > hold, preview update real-time
9. Sources toggles: auto save với debounce, toast confirm
10. Password change form: validate match, submit → success toast + re-login (mock)
11. Settings tất cả 6 sections collapsible, F5 giữ state mở/đóng (localStorage)
12. Mobile: settings sections stack, modals full-screen

---

## 11. Lưu ý

- PDF MVP = **text/table only** (không charts) — TAD c06 chốt rõ. Đừng cố render Recharts vào PDF.
- Share link MVP có Basic Auth — mock chỉ check token, không thực sự enforce password (note rõ trong UX).
- Telegram error UX phải distinct: success xanh / error đỏ với message cụ thể.
- Threshold validate phải block save nếu invalid (UI feedback rõ).
- Đây là cụm cuối — sau cụm này prototype UI/UX hoàn chỉnh, sẵn sàng integrate backend thật ở phase sau.
