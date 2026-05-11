# Phase 1 — DB + Constants + Seed REVIEW

**Done:** ~2026-05-10 (~3h, estimate 1d)
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Retrospective focus: insights *non-obvious* — bài học lớn nhất: ĐỌC SRS đầy đủ TRƯỚC khi viết constants.

## Surprises / non-obvious

- **Phase 1 ĐOÁN SAI 5+ enum/constants** vì spec scattered across SRS+TAD+g03. Fix Phase 3-4:
  - **RunStatus 7 canonical** chứ không phải `RUNNING/PROCESSING/PARTIAL/CANCELLED` mình đoán. Đúng = `{PENDING, CHECKING_DATA, SCREENING, SCORING, COMPLETED, COMPLETED_WITH_WARNINGS, FAILED}` (TAD g01 §2.1).
  - **EntrySignal 7 canonical** đúng `{INSUFFICIENT_DATA, NO_ENTRY, BUY_STRONG, BUY_NOW, WAIT_FOR_BREAKOUT, WAIT_FOR_PULLBACK, WAIT_FOR_CONFIRMATION}` — KHÔNG dùng `BUY_DIP/HOLD/SELL/NO_SIGNAL`.
  - **Recommendation ASCII** (`MUA/GIU/BAN`) không diacritics trong enum value (UI/i18n mới có diacritics).
  - **WARNING_BADGES 4** (HIGH_DEBT/NEGATIVE_OCF/LEGAL_RISK/HIGH_INVENTORY) — đã trim 6 → 4 ở Phase 4.
  - **ENTRY_REASON_CODES 15** canonical (SRS g03 §N) — Phase 1 dùng 13 token sai whitelist.
  - **FILTER_EXCLUSION_CODES 6** match FE EXCLUDED_REASONS (`HIGH_DE/LEGAL_BLOCK/PENNY_PRICE/LOW_LIQUIDITY/INSUFFICIENT_DATA/NEWLY_LISTED`).
  - **CONFIDENCE_PENALTY** 1=5/2=10/3+=15/cap=20 (SRS g03 §K). Phase 1 đoán MAX=30 sai.
- **Bài học**: ĐỌC SRS g03 + TAD c0X kỹ TRƯỚC khi viết `constants/`. "DRIFT không thể tránh nếu không đọc đầy đủ" — đã trở thành rule trong `feedback_phase_process.md`.
- **Cache TTL drift**: Phase 1 đoán vnstock_price 24h, vnstock_financial 24h. Phase 3 fix per TAD g04 §1: `vnstock_price=4h`, `vnstock_financial=720h(30d)`, `macro_*=720h`, `news_*=6h`.

## Key decisions (why)

- **Default password `ChangeMe123!`**: 12 chars match TAD c08 §3 password rule. Acceptable cho dev. Production phải đổi qua /api/auth/password (Phase 2 endpoint).
- **Seed idempotent**: chạy nhiều lần không duplicate (CHECK EXISTS pattern). Quan trọng vì tests autouse `_ensure_seeded`.
- **Macro M01-M05 hardcode 2026Q2**: interest 5%, credit 12%, CPI 3.5%, FDI 4B USD, VN-Index 1300. Production crawler post-MVP.

## To revisit

- TAD g03 §K cache TTL có thể cần update lại nếu vnstock thực tế rate-limit khác.
- Stocks whitelist 81 mã hardcoded — production cần CRUD endpoint nếu add mã mới.
- `Transaction` table reserved (Phase 1 model) nhưng KHÔNG endpoint dùng → post-MVP.
