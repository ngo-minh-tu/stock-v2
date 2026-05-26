# Phase 15 — Financial Data Ingestion REVIEW

**Started:** 2026-05-19  
**Completed:** 2026-05-19  
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Retrospective focus: Phase 15 đóng phần BCTC thật còn treo sau Phase 14, nhưng vẫn giữ nguyên ranh giới an toàn: không chạy network thật và không mở API mới khi TAD chưa yêu cầu.

## Surprises / non-obvious

- `vnstock 4.0.2` có `vnstock.api.financial.Finance`, không cần nâng dependency.
- VCI/KBS financial DataFrame thiên về dạng `item_id` làm row và kỳ báo cáo làm column; parser cần pivot ngược về row theo kỳ.
- Ratio data có thể lỗi riêng; phase này không để lỗi ratio làm fail toàn bộ BCTC nếu income/balance/cash vẫn có dữ liệu.
- Cache `vnstock_financial` phải theo cùng logic source-level như price: partial data không được làm downstream tưởng toàn bộ source đã fresh.
- Không nên thêm `/refresh/financials` trong phase này vì TAD g02 hiện chưa định nghĩa endpoint đó.

## Key decisions

- Dùng VCI Finance quarterly report làm source mặc định.
- Map alias tài chính về đúng fields TAD: revenue, net_income, total_assets, total_equity, total_debt, current_assets, current_liabilities, inventory, cogs, operating_cash_flow, eps, bvps, advances, shares_outstanding, audit_opinion.
- Upsert theo `(ticker, period)` để refresh lặp lại không nhân bản dữ liệu.
- Giữ status job `COMPLETED` khi price có success, còn chi tiết BCTC nằm trong `stats.financials`.
- Không chạy refresh thật full 81 mã trong phase này vì cần network/quota/API key và user đã yêu cầu hạn chế chạy ngoài sandbox.

## To revisit

- Chạy subset production thật với 1-3 mã để xác nhận field alias trên dữ liệu live.
- Nếu refresh production kéo dài, persist refresh/ticker history thay vì giữ in-memory.
- Cân nhắc endpoint riêng `/refresh/financials` sau khi cập nhật TAD g02.
- Bổ sung Playwright smoke cho luồng refresh/status nếu frontend cần hiển thị stats financial.
