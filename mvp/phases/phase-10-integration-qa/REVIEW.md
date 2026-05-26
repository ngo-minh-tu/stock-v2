# Phase 10 — Integration QA + Bug Fixes REVIEW

**Done:** 2026-05-11 (~3h, estimate 1d — under-run vì Phase 9 đã clear hầu hết drift; chỉ còn 1 bug tích lũy)
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Retrospective focus: Test state pollution surprise (34 ERROR ≠ 34 bug), low yield bug count (1/39 endpoints có drift) gợi ý FE/BE swap đã làm tốt từ Phase 9, nhưng tier-2 endpoints (less-tested) vẫn drift được. Subagent audit shape — không phải behavior.

## Surprises / non-obvious

- **34 "ERROR" ban đầu = 1 root cause = 0 backend bug**. Baseline pytest run hiện 34 ERROR `UNIQUE constraint failed: financial_reports.ticker, financial_reports.period`. First instinct: regression backend. Reality: fixture `screening_data` teardown skip khi pytest abort (Ctrl+C, TaskStop, OOM). 324 stale rows (81 tickers × 4 quarters) persist từ run trước. Mitigation: manual cleanup script — 232/232 pass ngay sau đó. **Lesson: "pytest đỏ" cần check fixture state trước khi nghi code.**
- **Subagent audit pattern lớn (17 SRS files) hiệu quả nhưng có blind spot**: Explore subagent reported "Critical Drift: 0" — nhưng bug Password Change (Bug-1) chỉ surface khi tôi tự curl manually. Vì sao? Subagent check **endpoint tồn tại + schema match** — nhưng FE consumer expectation (`current_password` vs `current`) không nằm trong backend code path. **Audit code-level pattern catches structural drift, không catch consumer-end mismatch**. Cần FE-grep step bổ sung.
- **Bug-1 (Password Change) là Phase 9 carry-over**: Phase 9 reconcile 7 surfaces nhưng skip `/auth/password`. Lý do: lower traffic, FE prototype MSW always accept any shape (line 130: `body.current_password` check) → Phase 9 type check pass, runtime curl không verify. Backend dùng Pydantic `extra="forbid"` → mọi FE-shape miss bị 422 ngay. Có 3 location drift: types.ts (cả request + response shape), PasswordChangeForm.tsx (line 45 body), handlers.ts (cả MSW handler 130-141). **MSW prototype "always permissive" làm mask FE/BE schema drift suốt 6 cluster + Phase 9.**
- **PDF binary smoke pass instantly**: kỳ vọng debug WeasyPrint font (Phase 9 §6 carryover concern). Reality: 29KB PDF, `file` reports valid `PDF document, version 1.7`. Docker layer cài libpango + Noto fonts đã đủ. Không hit fallback `html_mock` mode.
- **Backtest 2-stage polling ~2s real vs 8.5s prototype**: real backend chạy nhanh hơn FE mock ngày xưa 4x. Cluster 5 UX prototype 4-stage % bar đã reasonable cho mock chậm, không cần thiết cho real fast. Validation cho decision Phase 9 §2 #4 (downgrade sang spinner).
- **Compare-with-self trả ERR-12-01 đẹp**: thường developers quên symmetric edge case (`run_id_a === run_id_b`). Phase 7 đã code defensive check + register ERR-12-01 "Không thể so sánh cùng 1 run". Curl verify → 400 envelope sạch, không 500.
- **Token rotation post-password-change subtle**: response trả `{token}` chỉ — FE PasswordChangeForm phải `localStorage.setItem('token', data.token)` ngay. Nếu skip: request kế dùng token cũ vẫn valid 24h TTL (chưa expired) → user không bị logout nhưng next refresh sẽ 401. Hard to catch trong unit test.
- **State cleanup FK order matters**: smoke test cleanup script bị fail lần đầu vì `share_links` FK reference `screening_runs.run_id`. Phải DELETE share_links TRƯỚC screening_runs. SQLite không cascade tự — phải explicit order.

## Key decisions (why)

- **AC verification = code-level audit (subagent) + curl smoke, KHÔNG interactive browser test**: trade-off — Phase 9 đã làm `tsc + build + envelope curl + CORS preflight` (structural). Phase 10 thêm subagent shape audit + critical-path curl (behavioral). Browser interactive defer post-MVP (Playwright pack §6). Lý do: visual regression không phải MVP success criteria; backend correctness + envelope consistency là.
- **Bug-1 fix direction: FE adapts BE (không ngược)**: Memory rule "Schema canonical = TAD g02; FE drift reconciles toward backend". Trade-off: rename FE field `current_password → current` (1 file types.ts + 1 file form + 1 file MSW handler) vs alias backend Pydantic `current_password`. Backend hiện đã có `populate_by_name` cho `new_password` alias `new` — adding another alias bloat Pydantic. FE fix cleaner.
- **MSW handler update đồng bộ**: Phase 9 convention "both codepaths must match types". Devs flip `MSW=true` cho offline demo vẫn cần compile + chạy. Cost: +1 file edit cho MSW handler, nhưng giữ prototype mode usable.
- **Drop `changed: true` từ response**: backend chỉ emit `{token}`. FE có thể derive "changed" boolean từ response success status (200 vs error). Dropping field giảm schema surface area; FE PasswordChangeForm.tsx success path đã không check `data.changed` (chỉ dùng `data.token`).
- **State cleanup script trong README, không trong fixture autouse**: trade-off — autouse fixture pre-clean tất cả test sẽ slow down 232 tests (mỗi test +DB hit). Manual script chỉ run khi cần (after abort). Phase 10 §6 issues entry tracks này; post-MVP có thể optimize.
- **Smoke seed 5 anchor tickers, không full 81**: full 81 run mất ~3s extra cho mỗi smoke iteration. 5 (VHM/KDH/NLG/DXG/PDR) đã cover 4-round filter + entry signal + risk paths. Phase 5 integration tests đã verify 81-ticker scale.
- **Tạo `report/mvp-build/SUMMARY.md` ngoài `mvp/phases/`**: build-wide summary thuộc về `report/` cùng với 6 cluster summaries (cluster-1..6-summary.md). `mvp/phases/` chỉ chứa per-phase audit trail. Phân tách giúp dev mới onboarding tìm 1-page status nhanh ở `report/`.

## To revisit

- **State pollution prevention**: post-MVP add session-scope autouse fixture pre-clean `financial_reports + stock_prices + screening_* + share_links + backtest_*` trước yield. Hoặc dùng savepoint/rollback per test (chậm hơn nhưng atomic).
- **FE consumer expectation audit**: subagent SRS audit miss Bug-1 vì check backend-side only. Post-MVP add `grep FE_field_name in backend_schemas + grep backend_field in FE/types.ts` cross-check step trước khi merge cluster.
- **Stock Detail interactive smoke**: Phase 9+10 chỉ verify endpoint shape correct. Browser interactive (radar render? candlestick MA overlay correct? reason expand?) chưa run. Post-MVP Playwright.
- **PDF Vietnamese fidelity**: 29KB pass binary check, nhưng chưa visual diff. Mở thử trong browser/Preview thực tế — font Inter + Noto render đẹp chưa? Headers Vietnamese không bị tofu? Post-MVP visual regression test.
- **Telegram real-send chưa verify**: empty-creds path OK, nhưng valid token + chat_id chưa test với Bot API thật. Production deploy phải verify (user-provided creds).
- **Backtest progress restore option**: nếu sau MVP user request "thấy spinner boring, muốn % bar lại", add `progress_percent` column vào `backtest_runs` table + service tick logic. Memory note này trong Phase 8 SUMMARY §6 đã carry-over.
- **TAD §1 endpoint registry doc patch**: 3 endpoint gap (Phase 6+9) chưa update TAD. Một single doc patch post-MVP. Tracked report/mvp-build/SUMMARY.md §4.C.
- **Compare endpoint với 2 runs khác nhau**: smoke chỉ test compare-self (ERR-12-01). Khi có 2 COMPLETED runs khác, cần verify 4-section diff shape khớp FE expectation. Integration test `test_compare.py` đã có (4 tests pass), nhưng curl manual chưa.
- **Refresh job lock 409 verified, nhưng job ghost on server restart chưa**: PLAN risk register §4 đề cập "khi server restart giữa run → mark PROCESSING > X phút thành FAILED". Backend Phase 5 đã code logic này (TAD g05) — Phase 10 không test trực tiếp. Post-MVP integration test.
- **No FE unit tests** (carry-over Phase 9 §6): chỉ tsc + build verify. Critical path Playwright pack vẫn pending.
- **Phase 11 hand-off**: README sẽ document state cleanup script + curl examples. Convention "verify before commit" trong Phase 11 sẽ smoke test commands.
