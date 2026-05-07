# Cluster 6 — Export & Integrations (PDF + Share + Telegram + Settings full)

## 1. Metadata

- **Cluster:** 6 — Export & Integrations
- **Khoảng ngày:** 2026-05-07 (1 phiên build)
- **Commit hash kết thúc:** sẽ ghi sau khi commit
- **Prompt:** [prompts/cluster-6-export-integrations.md](../prompts/cluster-6-export-integrations.md)

## 2. Phạm vi — dự kiến vs thực tế

Triển khai đầy đủ 4 nhóm tính năng theo prompt:
- PDF Export (3 entry points: Dashboard, Top MUA, Run History row)
- Share Link (modal + public `/share/{token}` page + Settings management)
- Telegram (toggle + chat_id/token/topN + test send)
- Settings full (6 sections collapsible với localStorage state)

**Cắt/hoãn:**
- "Hủy bỏ link cũ khi regenerate" — prompt §4.2 không yêu cầu, để 2 link cùng tồn tại tới khi hết hạn / user thu hồi thủ công.
- `MockOutcomePicker` (cluster 1) giữ trong section Giao diện — prompt liệt kê 6 sections và không nhắc dev-only picker, nhưng giữ lại để PO test 4 nhánh UX. Có thể di dời nếu user muốn.

## 3. File mới

**Page (1):**
- [src/app/share/[token]/page.tsx](../prototype/src/app/share/%5Btoken%5D/page.tsx) — public route, không qua AppShell/ProtectedRoute.

**Components export (2):**
- [ExportPdfButton.tsx](../prototype/src/components/export/ExportPdfButton.tsx) — 2 variant (label/icon), preview optional.
- [PdfPreviewModal.tsx](../prototype/src/components/export/PdfPreviewModal.tsx) — iframe sandbox=""+srcDoc render HTML preview.

**Components share (3):**
- [ShareButton.tsx](../prototype/src/components/share/ShareButton.tsx) — trigger modal.
- [ShareLinkModal.tsx](../prototype/src/components/share/ShareLinkModal.tsx) — auto-create on open, copy URL, regenerate, countdown.
- [SharedView.tsx](../prototype/src/components/share/SharedView.tsx) — header + Dashboard + Top MUA read-only + watermark + invalid/expired states.

**Components telegram (2):**
- [TelegramSettings.tsx](../prototype/src/components/telegram/TelegramSettings.tsx) — toggle, fields, explicit save.
- [TelegramTestButton.tsx](../prototype/src/components/telegram/TelegramTestButton.tsx) — POST /telegram/test, distinct success/error toast.

**Components settings (5):**
- [CollapsibleSection.tsx](../prototype/src/components/settings/CollapsibleSection.tsx) — wrapper, localStorage open state.
- [ThresholdSliders.tsx](../prototype/src/components/settings/ThresholdSliders.tsx) — 2 range slider, debounce 500ms, validate buy>hold.
- [NewsSourcesToggles.tsx](../prototype/src/components/settings/NewsSourcesToggles.tsx) — 5 toggle, auto-save mỗi click.
- [PasswordChangeForm.tsx](../prototype/src/components/settings/PasswordChangeForm.tsx) — 3 input + validate match + persist new token.
- [ShareLinksManagement.tsx](../prototype/src/components/settings/ShareLinksManagement.tsx) — table + revoke với confirm.

**Hooks (3):**
- [useExportPdf.ts](../prototype/src/lib/hooks/useExportPdf.ts) — fetchPdf, triggerDownload qua `<a download>` blob URL, preview-then-confirm flow.
- [useShareLink.ts](../prototype/src/lib/hooks/useShareLink.ts) — `useShareCreate` + `useShareManage` (list+revoke+reload).
- [useSettingsFull.ts](../prototype/src/lib/hooks/useSettingsFull.ts) — fetch + save partial patch + bump reloadKey.

**Mock data (2):**
- [share-store.ts](../prototype/src/mocks/data/share-store.ts) — singleton `byToken`, uuid v4, 7-day TTL, isExpired helper.
- [pdf-template.ts](../prototype/src/mocks/data/pdf-template.ts) — buildPdfHtml: cover + KPI + Top MUA + Red Flags + Disclaimer.

## 4. File sửa

- [src/lib/types.ts](../prototype/src/lib/types.ts) — thêm `ShareCreateRequest/Response`, `ShareLink`, `ShareListResponse`, `SharedViewResponse`, `TelegramTestResponse`, `PasswordChangeRequest/Response`. Tất cả ở cuối file dưới comment Cluster 6 banner.
- [src/mocks/handlers.ts](../prototype/src/mocks/handlers.ts) — wrap PUT `/auth/password` với validate + return new token; wire validate vào PUT `/settings`; thêm GET `/export/pdf/{run_id}`, GET/POST/GET-token/DELETE `/share`, POST `/telegram/test`.
- [src/mocks/data/settings.ts](../prototype/src/mocks/data/settings.ts) — `validateSettingsPatch` mirror SRS f15 §Validation (buy>hold, telegram_top_n in [3,5], theme/classic_mode/language enum, telegram_enabled requires chat_id+token).
- [src/components/tables/TopMuaTable.tsx](../prototype/src/components/tables/TopMuaTable.tsx) — thêm prop `readOnly`: ẩn expander column + ticker thành span (không bấm được).
- [src/app/(app)/page.tsx](../prototype/src/app/(app)/page.tsx) — thêm Export+Share button cạnh RunSelector.
- [src/app/(app)/top-mua/page.tsx](../prototype/src/app/(app)/top-mua/page.tsx) — thêm Export+Share button (label "Xuất PDF Top MUA"), chuyển header sang flex.
- [src/components/run-history/RunHistoryTable.tsx](../prototype/src/components/run-history/RunHistoryTable.tsx) — thêm icon Export trong action column (preview=false → download trực tiếp).
- [src/app/(app)/settings/page.tsx](../prototype/src/app/(app)/settings/page.tsx) — rewrite từ 4 card thành 6 CollapsibleSection.
- [src/messages/vi.json](../prototype/src/messages/vi.json), [en.json](../prototype/src/messages/en.json) — thêm namespace `export.*`, `share.*`, `telegram.*`, mở rộng `settings.*` (section/threshold/sources/telegram/password/share); thêm `topMua.exportPdfTopMua`, `runHistory.action.exportPdf`.

## 5. Refactor / nâng cấp

- **TopMuaTable bổ sung readOnly mode** — không phải refactor lớn, chỉ nhánh hóa expander column + cell ticker. Cluster sau muốn tắt 1 phần UI có thể follow pattern.
- **Settings page chuyển từ flat → collapsible** — pattern CollapsibleSection có thể tái dụng cho các trang Settings/Filters tương lai.
- **Settings validation server-side mirror client-side** — giống cluster 5 (`validateHolding`/`validateBacktest`); `validateSettingsPatch` build effective state (current ⊕ patch) trước khi check để cross-field rules (buy>hold, enabled→fields) đúng cả khi user gửi single-field PUT.

## 6. Quyết định kỹ thuật

- **PDF MVP = HTML serve as application/pdf** — TAD c06 chốt MVP là text/table only, weasyprint là backend thật. Prototype chỉ test UX nên build HTML, gắn `Content-Disposition: attachment` + iframe `srcDoc` cho preview. Trade-off: file `.pdf` tải về thực ra là HTML — mở bằng trình đọc PDF sẽ fail; mở bằng browser sẽ render. Acceptable cho prototype, ghi rõ trong cluster prompt §3.3 "không render PDF thật trong browser".
- **iframe sandbox=""** — tối thiểu privilege: không script, không form, không link điều hướng — vì preview HTML có thể chứa data từ run và không cần execute gì. CSS embedded vẫn work.
- **uuid v4 mock fallback** — `crypto.randomUUID()` first, fallback Math.random regex pattern cho môi trường test không có Web Crypto API.
- **Share URL có 2 dạng** — store giữ `https://app.example/share/{token}` (mock backend URL theo TAD) nhưng button copy ghi `${window.location.origin}/share/{token}` để user mở được trên cùng tab. Hơi hack nhưng prototype-friendly.
- **`validateSettingsPatch` build effective next state** — không validate trực tiếp `patch` vì single-field PUT (vd `{language:'ENG'}`) không có buy/hold để check cross-field. Build merged state rồi check tất cả rules — đảm bảo race-free.
- **Telegram save: explicit, KHÔNG debounce** — prompt §6.5 "Explicit save: telegram (test trước khi save)". Vì validation `enabled+empty fields → 400`, nếu auto-save theo từng keystroke sẽ đẩy 400 liên tục mid-typing.
- **Threshold debounce 500ms** — prompt §6.5 yêu cầu rõ. Implement với `setTimeout` + cleanup, lastSavedRef tránh save trùng giá trị.
- **NewsSourcesToggles auto-save không debounce** — toggle là discrete click, prompt §6.5 list "sources toggles" trong nhóm auto-save nhưng không bắt buộc debounce. Mỗi click 1 PUT.
- **`/share/[token]` ngoài `(app)` group** — bypass ProtectedRoute để công khai. `force-dynamic` để Next không pre-render token-specific routes. Token được check qua MSW client-side.
- **PasswordChangeForm mock re-login** — handler trả token mới, form ghi đè localStorage; AuthContext.token state đã hydrate sẵn (non-null) nên user vẫn coi là authenticated. apiFetch reads localStorage mỗi request → token mới được dùng tự động. Skip `setToken` qua AuthContext setter để tránh phụ thuộc API mới.

## 7. Dependencies

Không thêm/bỏ package. Cluster prompt §2 ghi rõ "Không thêm thư viện".

## 8. Mock data

**Share store** ([share-store.ts](../prototype/src/mocks/data/share-store.ts)):
- Map<token, ShareLink>. ShareLink shape: `{ token, run_id, url, created_at, expires_at }`.
- Methods: `list()` (newest first), `get(token)`, `create(run_id, days)`, `remove(token)`, `isExpired(link, nowMs)`.
- Khởi đầu rỗng — không seed link nào (cluster prompt không yêu cầu).
- Singleton qua `globalThis.__shareStore` (giống pattern cluster 2/5).

**PDF template** ([pdf-template.ts](../prototype/src/mocks/data/pdf-template.ts)):
- `buildPdfHtml({summary, dashboard, results, excluded, brand, tagline})` → HTML string (không phải DOM).
- Sections: header (brand+tagline+meta) → Tổng quan KPI grid → Top 10 MUA table → Top 20 Red Flags table → Disclaimer → Footer timestamp.
- Inline CSS — color palette match design.md SSI-style, không phụ thuộc theme runtime (PDF cần consistent xuất ra).

**Settings store** ([settings.ts](../prototype/src/mocks/data/settings.ts)):
- `validateSettingsPatch` thêm. `getSettings`/`patchSettings` không đổi shape.

## 9. Nợ kỹ thuật / TODO

- **PDF MVP là HTML giả lập** — production cần WeasyPrint thật theo TAD c06. Prototype dừng ở mức "click → tải file"; nội dung file mở bằng PDF reader sẽ broken.
- **Share view không thực sự enforce Basic Auth** — chỉ check token tồn tại + chưa expire. Production cần ngrok+Basic Auth theo PRD §7.12. Note text trong UX đã ghi rõ.
- **Settings PasswordChangeForm không update AuthContext.token state** — chỉ ghi localStorage. Trade-off: tránh cần thêm setter mới qua context. Nếu sau này có UI hiển thị token (vd. badge) thì cần bổ sung.
- **MockOutcomePicker giữ trong section Giao diện** — cluster prompt §6.1 list 6 sections và không nhắc dev-only picker này. Có thể di dời / hide tùy quyết định PO.
- **Share link không có rate limit / cap số lượng** — user spam regenerate sẽ tạo nhiều link cùng tồn tại. Production nên giới hạn N link/run hoặc auto-revoke link cũ khi regenerate.
- **`runsStore.start()` vẫn hardcode `'baseline_v2'` / `2`** — cluster 5 memory ghi note "Cluster 6 sẽ wire model_version + settings_version từ Settings UI". Cluster prompt 6 không yêu cầu rõ; vẫn để TODO sang phase backend thật.
- **Mobile modal full-screen** — prompt §10.12 yêu cầu "modals full-screen mobile"; hiện modals dùng `max-w-*` + `px-4` margin, vẫn fit nhưng không full-bleed. Acceptable cho prototype, có thể polish khi user test.

## 10. Ảnh hưởng cluster sau

Đây là cluster cuối — prototype UI/UX hoàn chỉnh, không có cluster 7. Phase tiếp theo là integrate backend thật (theo TAD g01-g08 + c01-c09):
- Replace MSW handlers bằng real API endpoints (FastAPI).
- Replace `pdf-template.ts` bằng WeasyPrint (TAD c06).
- Replace share-store bằng SQLite `share_links` table (g03 Table 15).
- Telegram test: gọi Telegram Bot API thật.

**Lưu ý cho phase backend:**
- Settings PUT validation server-side đã có pattern client-mirror (SRS f15 §Validation). Backend cần re-implement nguyên rules + bump `settings_version`.
- Share URL pattern `${origin}/share/{token}` — backend nên trả URL relative để frontend tự build với origin runtime, tránh hardcode domain.
- PDF download Content-Disposition + Content-Type cần match: `application/pdf` + `attachment; filename="run-{id}.pdf"`.

## 11. Test thủ công

**URL gốc:** `http://localhost:3001` (port có thể là 3000 nếu rảnh). Login mật khẩu bất kỳ.

### 11.1 PDF Export — 3 entry points

1. **Dashboard `/`** — chọn run → nút "Xuất PDF" cạnh RunSelector → modal preview hiện iframe HTML → click "Tải xuống" → file `run-{id}.pdf` xuất hiện trong Downloads + toast "Đã tải PDF".
2. **Top MUA `/top-mua`** — nút "Xuất PDF Top MUA" → cùng flow, label đổi.
3. **Run History `/run-history`** — icon Download trong action column → tải trực tiếp (không preview), toast.

**Kỳ vọng:** PDF (HTML) có header brand, KPI grid, top-10 MUA table, top-20 Red Flags, Disclaimer.

### 11.2 Share Link — full flow

1. Dashboard hoặc Top MUA → "Chia sẻ" → modal mở → loading → URL hiện ra (font mono, full-width).
2. Click "Sao chép" → toast "Đã sao chép link" + clipboard chứa `http://localhost:3001/share/{token}`.
3. Mở tab mới, paste URL → public Shared View hiện ra: header có watermark "Read-only shared view" + "Chia sẻ bởi Ngô Minh Tú ngày DD/MM/YYYY" + countdown "Hết hạn còn 7 ngày..."
4. Body: Dashboard 5 KPI + 6 visual + Top MUA table (không có icon expand, không có "Xem chi tiết").
5. Quay lại modal, click "Tạo link mới" → token mới sinh, URL update.
6. Đóng modal → mở Settings → section "Quản lý chia sẻ" → table list các link đang active.
7. Click thu hồi → confirm → link bị xóa → tab share trước đó refresh sẽ thấy "Link không hợp lệ".

### 11.3 Telegram

1. Settings → section "Telegram" → toggle bật → 3 field (token, chat_id, top N radio) hiện.
2. Điền token "abc123", chat_id "-1001234567" → "Lưu cấu hình Telegram" → toast "Đã lưu cấu hình Telegram".
3. "Gửi tin thử" — bấm 3-4 lần → ~70% toast xanh "Đã gửi tin thử", ~30% toast đỏ "Gửi tin thử thất bại" với error message.
4. Toggle bật + để trống chat_id → click "Lưu" → inline error "Bật Telegram cần điền chat_id".

### 11.4 Threshold sliders

1. Settings → "Ngưỡng khuyến nghị" → kéo MUA slider lên 80, GIỮ slider 50 → preview line update real-time → 0,5s sau toast "Đã lưu ngưỡng".
2. Kéo MUA xuống ≤ GIỮ (vd. MUA=40, GIỮ=50) → inline error đỏ "Ngưỡng MUA phải lớn hơn ngưỡng GIỮ" → không có save fire.

### 11.5 Sources toggles

1. Settings → "Nguồn tin" → click toggle CafeF off → toast "Đã cập nhật nguồn tin · CafeF". Lặp với nguồn khác.

### 11.6 Password change

1. Settings → "Bảo mật" → nhập current = bất kỳ, new = "12345" → submit → error "Mật khẩu mới phải có ít nhất 8 ký tự".
2. new = "12345678", confirm = "87654321" → error "Mật khẩu xác nhận không khớp".
3. new+confirm khớp → submit → toast "Đã đổi mật khẩu". Form clear. Token localStorage update (xem DevTools → Application → Local Storage).

### 11.7 Collapsible state

1. Settings → đóng "Telegram" → F5 → vẫn đóng. Mở lại → F5 → vẫn mở. (localStorage key `settings.section.telegram`).

### 11.8 Share view — invalid/expired states

1. Mở `/share/invalid-token-xyz` → 404 card "Link không hợp lệ".
2. (Khó test thủ công 7-ngày expiry; có thể tạm sửa `share-store.ts` line 41 `expires_in_days` để rút ngắn TTL khi cần verify.)
