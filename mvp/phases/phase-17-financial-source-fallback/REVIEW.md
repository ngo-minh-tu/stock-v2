# Phase 17 — Financial Source Fallback REVIEW

**Started:** 2026-05-20  
**Completed:** 2026-05-20  
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Trọng tâm review: Phase 17 xử lý Finding 3 từ Phase 16 bằng cách thêm fallback BCTC `VCI -> KBS`. Câu hỏi chính là fallback này có làm tăng coverage mà không làm giảm chất lượng dữ liệu đã có không, và liệu kết quả “code fallback works” đã đủ an toàn để dựa vào trong các step Mốc 3 tiếp theo chưa.

## Findings

- **High — KBS fallback có thể ghi đè dữ liệu VCI cũ bằng row thiếu field.** [fetch_financials()](../../code/app/crawlers/vnstock_client.py#L194) trả ngay rows từ KBS khi VCI fail/empty, nhưng [financial_repo.bulk_upsert()](../../code/app/repositories/financial_repo.py#L38) conflict theo `(ticker, period)` và set toàn bộ `_UPSERT_FIELDS` từ `excluded`. Vì KBS alias mapping hiện còn thiếu `revenue`, `total_assets`, `total_liabilities` như summary đã ghi, một fallback thành công có thể overwrite row VCI giàu dữ liệu hơn bằng `NULL`/thiếu field cho cùng kỳ. Trước khi dùng fallback cho refresh lặp lại, cần policy merge không downgrade field đang có, hoặc lưu `source/quality` để chọn row tốt hơn.
- **Medium — KBS period suffix đang bị collapse âm thầm.** Summary ghi KBS có cột dạng `2025-Q4_1` và `2025-Q4`. [_parse_quarter_period()](../../code/app/crawlers/vnstock_client.py#L357) parse cả hai về cùng `2025Q4`; sau đó [_merge_financial_frames()](../../code/app/crawlers/vnstock_client.py#L267) merge theo key `yearQquarter`, nên một cột sẽ overwrite cột còn lại theo thứ tự DataFrame. Nếu `_1` là bản điều chỉnh/restated hoặc một loại kỳ khác, dữ liệu cuối cùng không còn trace được đã chọn bản nào. Cần rule rõ: ưu tiên audited/restated, hoặc drop suffix có chủ đích và log decision.
- **Medium — Test chưa cover behavior chính của phase.** `tests/unit/test_vnstock_client.py` hiện cover financial parser happy path và all-source SystemExit, nhưng chưa có test cho VCI exception -> KBS success, VCI empty -> KBS success, thứ tự source, và message khi all sources fail. Vì Phase 17 deliverable chính là fallback chain, nên cần regression trực tiếp cho chain này thay vì chỉ dựa vào real-network verification.
- **Low — `_FINANCIAL_FIELDS` đang unused.** Constant ở [vnstock_client.py](../../code/app/crawlers/vnstock_client.py#L25) không được dùng để validate output hay completeness. Nếu giữ lại, nên dùng nó để tính quality/completeness score cho mỗi source; nếu không thì bỏ để tránh cảm giác đã có schema guard trong khi thực tế chưa có.

## Đã kiểm chứng

- Đã đọc Phase 17 summary trong `mvp/phases/...` và bản mirror trong `report/phase-mvp/...`.
- Đã review implementation quanh `vnstock_client.py`, `financial_repo.py`, `screening_service.py`, `feature_service.py` và unit test hiện tại.
- Targeted unit test hiện tại pass:

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code
uv run pytest tests/unit/test_vnstock_client.py -q
# 5 tests passed
```

## Điểm làm tốt

- Phase này xử lý đúng vấn đề còn treo từ Phase 16: VCI không cover đủ BCTC real ticker, và KBS là fallback khả dụng duy nhất trong `vnstock 4.0.2`.
- Việc tách `_fetch_financials_source()` làm boundary rõ hơn: một source attempt gọi đủ income/balance/cash/ratio, còn `fetch_financials()` chịu trách nhiệm fallback.
- Giữ `vnstock_financial=PARTIAL` khi run-level chưa 100% success là đúng TAD g04; không đánh tráo cumulative DB coverage thành cache FRESH.
- Real-data verification có giá trị: DB coverage tăng 12 -> 20 ticker và screening `scored_count` tăng 11 -> 14, chứng minh fallback có tác động thật.

## Cần revisit

- Thêm merge policy để fallback KBS không làm mất field VCI đã có trong DB.
- Chuẩn hoá handling cho các period suffix kiểu `2025-Q4_1` trước khi tin vào KBS rộng hơn.
- Bổ sung unit tests riêng cho fallback chain và test upsert không downgrade dữ liệu tài chính.
- Tách rate-limit strategy cho financial sub-calls; hiện `_gate_wait()` per source attempt chưa đủ vì mỗi source attempt vẫn có 3-4 network calls.
