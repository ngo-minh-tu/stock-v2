# Phase 16 — MVP Data Readiness Closure REVIEW

**Started:** 2026-05-19  
**Completed:** 2026-05-20  
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Trọng tâm review: Phase 16 là bước đóng Mốc 2 ở mức dữ liệu thật. Câu hỏi chính không còn là code có chạy hay không, mà là vòng refresh + screening trên prod-like DB đã có ranh giới dữ liệu đủ chắc chưa: chỉ dùng real universe, chốt convention giá raw VND, cache theo source-level, và hand-off rõ ràng cho gap BCTC còn lại.

## Findings

- **Medium — Hand-off Finding 3 đang lệch với code hiện tại.** [SUMMARY.md](./SUMMARY.md#finding-3--vci-bctc-gap-carry) nói Mốc 3 vẫn cần thử fallback source `kbs`, nhưng [vnstock_client.py](../../code/app/crawlers/vnstock_client.py#L112) đã định nghĩa `_FINANCIAL_SOURCES = ("VCI", "KBS")` và [fetch_financials()](../../code/app/crawlers/vnstock_client.py#L194) đã chạy qua các fallback này. Trước khi bắt đầu Mốc 3, cần cập nhật summary cho đúng thực tế: hoặc KBS fallback đã được thử và vẫn còn gap 14/26, hoặc code fallback đang có nhưng chưa verify nên phải ghi là pending validation. Nếu không, phase sau dễ mất thời gian điều tra lại hoặc hiểu sai giới hạn ở source-level.
- **Medium — Fix price unit cần regression test trực tiếp và note cho DB cũ.** [fetch_prices()](../../code/app/crawlers/vnstock_client.py#L172) hiện scale OHLC từ VCI lên 1000 lần qua [_scale_vnd()](../../code/app/crawlers/vnstock_client.py#L255), giúp sửa lỗi loại nhầm `PENNY_PRICE` trên dữ liệu thật. Test hiện tại cover lỗi wrapper và parser tài chính, nhưng chưa assert trực tiếp `close=157 -> 157000`. Nên thêm unit test này vì đây đã là data contract bị lock. Đồng thời cần document rằng DB đã ingest trước fix phải refresh từ DB sạch hoặc kiểm tra mixed-unit historical rows, vì [price_repo.bulk_upsert()](../../code/app/repositories/price_repo.py#L23) chỉ overwrite các ngày mà lần fetch mới trả về.
- **Low — Việc loại mock đang dựa vào convention tên ticker.** [list_active_tickers()](../../code/app/repositories/stock_repo.py#L11) hiện có nghĩa là `ACTIVE AND ticker NOT LIKE 'MOCK%'`, không còn đơn thuần là active stocks. Cách này chấp nhận được để đóng Mốc 2 mà không cần migration, nhưng là ranh giới universe khá giòn. Nếu tiếp tục mở rộng sau MVP, nên chuyển sang status/source flag rõ ràng hoặc production universe config để refresh, screening, demo data và tests không phụ thuộc vào convention đặt tên.

## Đã kiểm chứng

- Đã đọc Phase 16 summary trong `mvp/phases/...` và bản mirror trong `report/phase-mvp/...`.
- Đã review implementation quanh `vnstock_client.py`, `stock_repo.py`, `refresh_service.py`, `price_repo.py` và các test liên quan.
- Targeted regression pass:

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code
uv run pytest tests/unit/test_vnstock_client.py tests/integration/test_refresh.py tests/integration/test_run_lifecycle.py -q
# 35 tests passed
```

## Điểm làm tốt

- Phase này tìm đúng loại bug chỉ lộ khi chạy production data thật: mismatch đơn vị ở ingest boundary, seed mock làm nhiễu refresh universe, và lỗi BCTC phụ thuộc source.
- Chốt convention giá DB là raw VND là hướng đúng vì align được `demo_seed`, filter thresholds, feature calculations và API serialization.
- Tách `vnstock_price=FRESH` với `vnstock_financial=PARTIAL` đúng tinh thần TAD g04 hơn là ép toàn bộ hệ thống vào một trạng thái all-or-nothing.
- Loại mock tickers khỏi production refresh giúp cache freshness có ý nghĩa trở lại và làm `scored_count > 0` trở thành kết quả từ real data, không phải artifact từ fixture.

## Cần revisit

- Sửa mismatch giữa documentation và code ở Finding 3 trước khi planning Mốc 3.
- Thêm unit test trực tiếp cho VCI OHLC scaling; nếu được, thêm DB sanity check nhỏ để flag giá thấp bất thường dưới raw-VND bound với các real ticker không phải penny.
- Thay filter `MOCK%` bằng universe marker rõ ràng nếu production data handling tiếp tục sau MVP.
- Giữ kết quả 0 MUA như câu hỏi tuning, không xem là blocker của Phase 16; closure target của phase này là scoring được real data, không phải calibration buy-signal.
