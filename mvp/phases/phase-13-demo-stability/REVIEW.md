# Phase 13 — Demo Stability REVIEW

**Started:** 2026-05-18  
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Retrospective focus: Phase 12 phát hiện local smoke có thể trả 0 results, và sau đó full pytest có thể làm demo DB trống vì tests dùng chung SQLite dev DB. Phase 13 giải quyết lớp vận hành này trước khi đi tiếp production-data hardening.

## Surprises / non-obvious

- **DB test phải set trước import app**: `app.db.session` build SQLAlchemy engine tại import time. Vì vậy `tests/conftest.py` phải set `APP_ENV`/`DB_PATH` trước khi import `app.main`, `engine`, hoặc model metadata.
- **Guard theo filename hữu ích hơn chỉ dựa `APP_ENV`**: `APP_ENV=test` có thể bị set nhầm. Kiểm tra filename có chữ `test` giúp fail sớm nếu lỡ trỏ vào `screener.db` hoặc `demo-screener.db`.
- **Demo seed nên đi qua pipeline thật**: insert thẳng `screening_results` sẽ nhanh hơn nhưng dễ lệch shape/business logic. Phase này chọn tạo prices/BCTC synthetic rồi gọi `screening_service.run_screening`.
- **Default buy threshold 75 làm demo không có Top MUA**: synthetic data ban đầu tạo 81 rows nhưng đều `GIU`. Demo seed set ngưỡng buy 55 để Top MUA có dữ liệu visible.
- **Report và phase doc khác vai trò**: user chốt `report/` chỉ ghi làm gì/sửa gì; `mvp/phases/` vẫn theo audit trail giống phase trước.
- **Full pytest không xoá demo DB**: sau full backend suite, `demo-screener.db` vẫn còn 17.820 giá, 324 BCTC, 81 results và 21 mã MUA.

## Key decisions

- **Test DB riêng trong repo data dir**: dùng `./data/test-screener.db` thay vì dev DB hiện hữu. Dễ inspect khi fail, vẫn nằm trong `.gitignore`.
- **Demo DB riêng có guard**: `demo_seed.py` chỉ chạy nếu `DB_PATH` chứa chữ `demo`; tránh reset nhầm production-like DB.
- **Stable run id `run_demo_latest`**: dễ document, dễ dùng trong smoke/debug.
- **Report Phase 12/13 nằm dưới `report/phase-mvp/`**: user yêu cầu hai phase có điểm chung thì gom dưới folder chung.

## To revisit

- Chuyển test DB sang temp directory per run nếu có CI song song.
- Thêm nhiều demo runs để cover compare/backtest UX tốt hơn.
- Playwright smoke vẫn cần làm ở phase sau.
- Production-data ingestion vẫn chưa được xử lý trong Phase 13.
