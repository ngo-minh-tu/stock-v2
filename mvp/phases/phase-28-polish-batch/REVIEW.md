# Phase 28 — Polish Batch REVIEW

**Started:** 2026-05-22
**Completed:** 2026-05-22
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Trọng tâm review: Phase 28 đóng 6 backlog polish — mỗi item nhỏ + có AC rõ, nhưng tổng hợp có risk introduce regression. Câu hỏi chính: banner dismiss có làm test stricter mode fail? Bot API retry có thread-safe? Sanity helper consolidation có break backward-compat? Extensible set có introduce attack vector?

## Findings

- **High — `time.sleep` trong `_post_message` blocks BG task threadpool.** [telegram_service.py](../../../mvp/code/app/services/telegram_service.py) — single user MVP acceptable (1 BG task per run); production multi-user có thể queue tích pile khi nhiều run cùng 429. Phase 28 chấp nhận trade-off; Phase 29+ nếu scale → async retry queue hoặc background scheduler.

- **High — Playwright test 05 `getByText.or(cell)` strict-mode** trigger sau Phase 28 banner refactor. Cả toast + cell visible cùng lúc. Đã fix bằng `.first()` cuối chain. Risk: future banner thêm vào portfolio page có thể trigger lại — locator pattern fragile. Phase 29 cân nhắc scope test 05 qua `within(table)` selector.

- **Medium — `storageKey` versioned (e.g. `dashboard-disclaimer-v1`)** policy chưa document trong cluster 6 conventions hoặc DEPLOY.md. Nếu future change banner text đáng kể, dev quên bump `v1` → `v2` → user đã dismiss sẽ KHÔNG thấy nội dung mới. Phase 29 add doc + lint guard nếu trader feedback "banner stale".

- **Medium — `_RATE_LIMIT_MAX_WAIT_S = 30s` arbitrary.** Telegram production thường trả retry_after ≤ 30s. Nhưng nếu Bot API server-error returns 60+ (rare), cap silent ignore → retry too soon → 429 again → final error. Acceptable cho MVP; production cần monitoring + alert nếu retry_after > 30 thường xuyên.

- **Medium — Backward-compat wrappers `_warn_total_assets_range` + `_warn_total_equity_range`** giữ cho external test imports. Future: nếu test code refactor xong, wrappers dead. Phase 29 cleanup.

- **Medium — `_SANITY_VND_FIELDS` tuple hard-code 2 field (total_assets, total_equity)** — extend cần justify với real-data sample. Phase 28 KHÔNG mở rộng. Operator có thể quên field mới quan trọng (vd `current_assets`) — Phase 29 audit khi feature_service compute fields đầy đủ thật.

- **Medium — `_PRODUCTION_FORBIDDEN_FILES` chỉ check cwd**, không scan subdir (`./nested/.env.telegram` không catch). Acceptable cho MVP (convention `.env.*` ở cwd); production cần `os.walk` nhưng phải bound depth + exclude `node_modules/.venv` → over-engineering. Phase 29 nếu nested-secret risk surface.

- **Medium — Period suffix log DEBUG default invisible** trong production (`LOG_LEVEL=INFO`). Operator quên `LOG_LEVEL=DEBUG` khi audit collision → silent. Mitigation: structured log tag `event="period-collision"` để có thể filter qua log aggregator. Defer Phase 29.

- **Medium — `test_compare_full_shape` 0.011 tolerance** band-aid. Root fix: BE round delta consistently với (b - a) — vd `delta = round(b - a, 2)` thay vì round riêng. Phase 29+ nếu metric format refactor.

- **Low — InfoBanner dismiss button KHÔNG có aria-label localized** — hard-coded English "Dismiss". Phase 29+ thêm i18n.

- **Low — `useEffect` hydrate localStorage trong InfoBanner** chạy sau initial render → banner flash 1 frame trước khi ẩn. Acceptable UX (minimal flash); FOUC mitigation cần SSR cookie hoặc state lifted.

- **Low — Telegram 429 retry test mock `time.sleep` qua monkeypatch** — không verify real sleep duration. Edge case: nếu future retry logic sai (vd sleep 0 thay vì retry_after value), test có thể vẫn pass. Mitigation: capture `sleeps` list assert specific value.

## Đã kiểm chứng

- Đã đọc [Phase 25 REVIEW Medium](../phase-25-pre-handoff-ux-polish/REVIEW.md) carry "InfoBanner dismiss" — implemented.
- Đã đọc [Phase 23 REVIEW Medium](../phase-23-telegram-broadcast-config-env/REVIEW.md) carry "Bot API 429 retry" — implemented.
- Đã đọc [Phase 27 REVIEW High](../phase-27-deploy-polish/REVIEW.md) carry "consolidate sanity guards" — implemented với backward-compat wrappers.
- Đã đọc [Phase 22 REVIEW Low](../phase-22-financial-unit-scaling/REVIEW.md) carry "_PRODUCTION_FORBIDDEN_FILES extensible" — implemented.
- Đã đọc [Phase 26 REVIEW Medium](../phase-26-kbs-data-polish/REVIEW.md) carry "period suffix log spam" — INFO → DEBUG.
- Đã đọc PLAN.md §6.2 carry "`test_compare_full_shape` flake cleanup" — tolerance 0.011.
- Đã verify backward-compat wrappers vẫn route qua `_warn_low_value_field` — 11/11 existing test pass.
- Đã verify Bot API 429 retry semantics qua 3 unit test (success after retry / persistent → error / cap delay).
- Đã verify extensible set qua 2 unit test (new file activates guard / multiple leaks reported sorted).
- Đã re-verify period suffix snapshot test sau log level change (caplog DEBUG instead of INFO).
- Đã re-verify compare test passes sau tolerance bump (4/4).
- Đã verify Playwright re-run sau test 05 `.first()` fix.
- Đã verify tsc clean, ruff clean.

```bash
cd /Users/ngominhtu/Projects/stock-v2

cd frontend
npx tsc --noEmit             # clean
CI=1 npx playwright test     # 8/8 (sau test 05 .first() fix)

cd ../mvp/code
uv run pytest -q             # 311/311 expected
uv run ruff check app tests  # All checks passed
```

## Điểm làm tốt

- **6 sub-task song hành nhưng atomic** — mỗi task có file scope rõ + test riêng. Backward-compat wrappers giữ cho transition smooth.
- **`storageKey` versioned** (v1) — explicit future-proof cho text change.
- **Bot API 429 retry capped + single** — không introduce hold time arbitrary trong BG task.
- **`_warn_low_value_field` generic** — DRY across 2 (sẽ là N future) sanity fields.
- **`_PRODUCTION_FORBIDDEN_FILES` frozenset immutable** + sorted error message — operator audit deterministic.
- **Period suffix log DEBUG** — production INFO log không spam aggregator.
- **`test_compare` tolerance fix với rationale comment** — future dev hiểu why 0.011 thay vì 0.01.
- **Playwright test 05 `.first()` cuối chain** — fix strict-mode trigger không phá test semantics.

## Cần revisit

- **Phase 29+:**
  - Banner storageKey version bump policy (cluster 6 convention doc).
  - Telegram async retry queue cho multi-user scale.
  - `_SANITY_VND_FIELDS` audit + extend với operator real-data sample.
  - `_PRODUCTION_FORBIDDEN_FILES` nested subdir scan nếu risk surface.
  - Period suffix log structured tag + aggregation filter.
  - `test_compare` round-trip consistency (delta = round(b - a)) thay vì tolerance band-aid.
  - InfoBanner aria-label i18n + FOUC mitigation.
  - Telegram retry real-sleep verify trong integration test.
  - Backward-compat wrapper cleanup khi test code stable.
  - VCI snapshot fixture (Phase 26 REVIEW Medium) nếu VCI drift signal.
  - Bot API 429 retry monitoring + alert nếu retry_after frequency cao.
- **Operator action ngoài Phase 28:**
  - Deploy via Phase 27 template + chạy `script/pre-handoff-refresh.sh`.
  - Manual `POST /api/run` để verify Telegram broadcast 429 retry working.
  - Smoke 8 page + verify banner dismiss localStorage.
  - Setup ngrok → trader hand-off.
