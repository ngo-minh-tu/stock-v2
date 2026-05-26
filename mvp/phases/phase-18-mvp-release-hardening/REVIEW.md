# Phase 18 — MVP Release Hardening REVIEW

**Started:** 2026-05-20  
**Completed:** 2026-05-20  
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Trọng tâm review: Phase 18 chuyển từ data-readiness sang release hardening, nên tiêu chí chính là khả năng vận hành an toàn: refresh không vượt quota, dữ liệu tài chính không bị downgrade, backup/restore chạy được ngoài môi trường dev, cron không rơi vào cấu hình giả định, và security status không bị hiểu nhầm là đã production-ready toàn bộ.

## Findings

- **High — `bulk_upsert()` vẫn có thể downgrade dữ liệu tài chính đã có.** [financial_repo.py](../../code/app/repositories/financial_repo.py#L43) normalize field thiếu thành `None`, rồi [on_conflict_do_update](../../code/app/repositories/financial_repo.py#L48) set toàn bộ `_UPSERT_FIELDS` bằng `excluded`. Cách này sửa lỗi SQLAlchemy với heterogeneous rows, nhưng chưa xử lý finding Phase 17: nếu KBS/fallback trả thiếu `revenue`, `total_assets`, `total_liabilities`, refresh sau có thể ghi đè row VCI giàu dữ liệu bằng `NULL`. Cần dùng merge policy không downgrade field hiện có, ví dụ `coalesce(excluded.field, FinancialReport.field)`, hoặc lưu source/quality để chọn row tốt hơn.
- **High — FE vẫn còn critical vulnerability nên “release hardening” không nên được hiểu là release-ready end-to-end.** Summary đã document defer Next/next-intl/postcss, nhưng Phase 18 status `COMPLETED` dễ bị đọc nhầm là toàn bộ MVP đã qua security gate. Nếu deploy có frontend public, critical `next` audit còn mở phải là release blocker hoặc ít nhất cần một marker rõ hơn trong hand-off: backend/tooling hardening complete, frontend release gate chưa pass.
- **Medium — Backup/restore scripts dùng relative default path, không khớp cron/deploy thực tế.** [backup-db.sh](../../../script/backup-db.sh#L13) và [restore-db.sh](../../../script/restore-db.sh#L20) default tới `./mvp/code/data/screener.db`. Khi chạy bằng cron với line absolute như summary đề xuất, working directory thường là `$HOME`, nên script sẽ tìm sai DB nếu không set `DB_PATH`. Nên derive repo root từ `BASH_SOURCE[0]` hoặc bắt buộc `DB_PATH` absolute trong production example/crontab.
- **Medium — Restore chưa atomic sau khi đã move DB hiện tại.** [restore-db.sh](../../../script/restore-db.sh#L43) move DB hiện tại sang snapshot rồi [cp](../../../script/restore-db.sh#L49) backup vào target. Nếu `cp` bị lỗi giữa chừng, target có thể thiếu hoặc partial, dù snapshot vẫn còn. Với restore production, nên copy vào temp cùng filesystem, integrity check temp, rồi `mv` atomic sang target.
- **Medium — `cron-refresh.sh` tự build JSON bằng string interpolation password.** [cron-refresh.sh](../../../script/cron-refresh.sh#L32) dùng `-d "{\"password\":\"${API_PASSWORD}\"}"`; password chứa dấu quote, backslash hoặc newline sẽ tạo JSON lỗi. Vì env production khuyến nghị password mạnh, nên nên JSON-encode bằng Python/jq hoặc đọc payload từ stdin được escape đúng.
- **Low — Per-sub-call gating chưa có regression test trực tiếp.** [vnstock_client.py](../../code/app/crawlers/vnstock_client.py#L220) gate từng income/balance/cash/ratio call, nhưng test hiện tại chỉ verify parser/error path. Nên thêm unit test spy `_gate_wait()` để khóa contract “4 gate calls/source attempt”, vì đây là fix chính giúp đạt `vnstock_financial=FRESH`.

## Đã kiểm chứng

- Đã đọc Phase 18 summary trong `mvp/phases/...` và bản mirror trong `report/phase-mvp/...`.
- Đã review implementation quanh `vnstock_client.py`, `financial_repo.py`, `env.production.example`, `backup-db.sh`, `restore-db.sh`, `cron-refresh.sh`.
- Targeted regression hiện tại pass:

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code
uv run pytest tests/unit/test_vnstock_client.py tests/integration/test_refresh.py -q
# 19 tests passed

cd /Users/ngominhtu/Projects/stock-v2
bash -n script/backup-db.sh
bash -n script/restore-db.sh
bash -n script/cron-refresh.sh
```

## Điểm làm tốt

- Per-sub-call gating là fix đúng gốc cho quota BCTC; kết quả real refresh đạt `vnstock_financial=FRESH` lần đầu là tín hiệu mạnh.
- Tách `env.production.example` riêng giúp giảm rủi ro dùng nhầm cấu hình dev/demo khi deploy.
- Backup dùng SQLite `.backup` API là lựa chọn đúng hơn `cp` khi DB có thể đang phục vụ request.
- Cron script có exit code rõ cho success/fail/timeout, phù hợp để gắn vào cron/systemd alerting.
- Backend security audit đã được xử lý đến 0 known vulnerabilities sau khi upgrade `idna`.

## Cần revisit

- Sửa `bulk_upsert()` theo hướng không overwrite field hiện có bằng `None`.
- Chặn release public cho tới khi FE critical audit được xử lý hoặc ghi release scope là backend-only.
- Làm script production độc lập với working directory, hoặc document `DB_PATH/API_PASSWORD/API_BASE` absolute trong crontab mẫu.
- Nâng restore thành atomic restore và thêm smoke test restore trên temp DB.
- Thêm regression test cho per-sub-call gating và cron JSON encoding.
