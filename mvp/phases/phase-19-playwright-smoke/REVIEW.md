# Phase 19 — Playwright Critical-Path Smoke REVIEW

**Started:** 2026-05-20  
**Completed:** 2026-05-20  
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Trọng tâm review: Phase 19 thêm browser smoke cho critical path, nên giá trị chính là bắt lỗi tích hợp FE↔BE mà unit/integration test không thấy. Review tập trung vào độ tin cậy của smoke: test có thật sự chứng minh path production không, hay chỉ pass nhờ demo/stub mode và trạng thái DB cũ.

## Findings

- **High — PDF E2E đang chạy `html_mock`, chưa cover production WeasyPrint binary path.** [e2e-start-backend.sh](../../../script/e2e-start-backend.sh#L17) ép `EXPORT_PDF_MODE=html_mock`, trong khi [useExportPdf.ts](../../../frontend/src/lib/hooks/useExportPdf.ts#L36) đọc response bằng `blob.text()` rồi tạo lại `Blob` type `application/pdf`. Với PDF binary thật từ WeasyPrint, bước này có rủi ro corrupt file; E2E pass vì html_mock là text. Cần tách preview HTML khỏi download PDF binary, hoặc E2E có thêm case chạy `EXPORT_PDF_MODE=weasyprint` và kiểm magic `%PDF`.
- **Medium — Refresh step có thể pass dù refresh thất bại.** [smoke.spec.ts](../../../frontend/tests/e2e/smoke.spec.ts#L90) chấp nhận cả `COMPLETED` và `FAILED`. Điều này làm step “refresh” chỉ chứng minh endpoint terminal, không chứng minh user/system có dữ liệu refresh usable. Nếu dùng `VNSTOCK_CLIENT_STUB=true` thì nên kỳ vọng rõ một contract demo riêng; nếu đây là release smoke, cần assert status thành công hoặc ít nhất assert failure reason đúng dự kiến.
- **Medium — Local E2E có thể reuse nhầm server không đúng mode.** [playwright.config.ts](../../../frontend/playwright.config.ts#L31) dùng `reuseExistingServer: !process.env.CI`; nếu dev đang có backend khác trên `:8000`, smoke có thể chạy vào DB/config không phải demo+stub. Với test destructive như portfolio cleanup, đây là rủi ro đáng kể. Nên mặc định không reuse backend, hoặc health endpoint expose `APP_ENV=demo` + `VNSTOCK_CLIENT_STUB=true` để test verify trước khi chạy.
- **Medium — Demo DB stale state vẫn là nguồn flake cho run-history/backtest/share/PDF.** Test 5 chỉ cleanup portfolio qua API, còn run history/backtest/share/PDF dùng state tích lũy trong `demo-screener.db`. Summary đã ghi thấy nhiều run cũ. Nên reset demo DB trước mỗi E2E run hoặc tạo run id riêng và buộc các step sau dùng run đó, tránh chọn nhầm baseline cũ.
- **Low — `HoldingFormModal` hard-code `TODAY=2026-05-07` vẫn còn trong code.** [HoldingFormModal.tsx](../../../frontend/src/components/portfolio/HoldingFormModal.tsx#L18) vẫn dùng ngày cố định và E2E né bằng cách giữ default date. Đây là bug UX thật sau ngày 2026-05-07; cần sửa bằng runtime date rồi cập nhật E2E để nhập ngày hiện tại.

## Đã kiểm chứng

- Đã đọc Phase 19 summary và review các file chính: Playwright spec/config, E2E backend launcher, dashboard reshape, PDF hook, portfolio modal, vnstock stub flag.
- Regression nhẹ hiện tại pass:

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code
uv run pytest tests/unit/test_vnstock_client.py tests/integration/test_dashboard.py tests/integration/test_telegram.py -q
# 15 tests passed

cd /Users/ngominhtu/Projects/stock-v2/frontend
npx tsc --noEmit

cd /Users/ngominhtu/Projects/stock-v2
bash -n script/e2e-start-backend.sh
```

## Điểm làm tốt

- Phase này bắt được drift FE↔BE dashboard schema, PDF base URL/auth, i18n key conflict và modal a11y; đây đúng là loại lỗi chỉ E2E mới phát hiện sớm.
- Chạy FE bằng production build thay vì dev server là lựa chọn đúng để giảm Fast Refresh flake.
- Thêm `VNSTOCK_CLIENT_STUB` giúp smoke không phụ thuộc network/quota vnstock.
- Smoke đi qua nhiều workflow thật trong browser: login, run, dashboard, portfolio, backtest, share, PDF.

## Cần revisit

- Sửa PDF hook để giữ binary PDF nguyên vẹn và thêm E2E/assertion cho WeasyPrint mode.
- Làm refresh smoke có expectation chặt hơn thay vì chấp nhận `FAILED`.
- Reset hoặc isolate demo DB trước E2E.
- Không reuse server sai mode, hoặc assert backend mode trước khi chạy test.
- Sửa `TODAY` hard-code trong portfolio modal.
