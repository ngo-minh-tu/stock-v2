# Phase 27 — Deploy Polish + useExportPdf + PriceBoard Placeholder + Equity Sanity Guard REVIEW

**Started:** 2026-05-22
**Completed:** 2026-05-22
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Trọng tâm review: Phase 27 đóng 3 carry-over polish + production deploy template (NOT live deploy). Câu hỏi chính: magic-byte detection có thực sự robust cho mọi PDF WeasyPrint variant? `docker-compose.yml` template có producer false sense of security cho operator? `_warn_total_equity_range` có overlap với Phase 25 assets guard không?

## Findings

- **High — Production deploy template NOT verified against live host.** [docker-compose.yml](../../../docker-compose.yml) + [nginx.conf](../../../script/nginx.conf) đều syntax-valid nhưng KHÔNG có integration test trên VPS thực. Operator có thể gặp issue về: (a) SELinux/AppArmor block volume mount, (b) Cloudflare WAF rule rejection `/api/share/{token}` POST, (c) Let's Encrypt rate limit khi reload nginx liên tục. Phase 27 chỉ verify template stand-alone (config parse, Dockerfile build smoke từ Phase 18). Operator chịu trách nhiệm live-deploy validation.

- **High — `useExportPdf` magic-byte detection chỉ check 4 byte đầu.** `%PDF` header có thể bị truncate nếu BE response stream chunked + first chunk < 4 bytes (rare). Phase 27 fallback: KHÔNG detect → treat as HTML mock → decode + corrupt. Mitigation: production CDN/proxy hầu hết chunk > 4 bytes; HTTP/2 streaming với 1-byte chunk là edge case. Phase 28 thêm `if (blob.size < 8) skip preview entirely` guard.

- **High — `_warn_total_equity_range` overlap với Phase 25 assets check.** Cả 2 guard chạy mỗi run pipeline → 26 ticker × 2 warn = 52 log lines nếu cả assets + equity đều < 1e9. Trùng noise. Acceptable cho MVP — operator grep `"below sanity floor"` filter chung; Phase 28 consolidate vào 1 sentinel function với multiple-field check.

- **Medium — docker-compose frontend mount source từ host** thay vì build image. Trade-off: cold start +30s npm install + filesystem dependency. Nếu host filesystem corrupt / xoá nhầm `node_modules`, container fail to start. Operator phải `docker compose down + git clean + docker compose up` để rebuild. Phase 28 cân nhắc multistage Dockerfile cho FE nếu deploy lên cluster.

- **Medium — `nginx.conf` thiếu rate-limit + `proxy_request_buffering off`.** Production cần protect /api/auth/login + /api/refresh/all (long-running) khỏi DoS. Phase 27 minimal config — operator wire Cloudflare WAF hoặc thêm `limit_req_zone` directive sau khi traffic pattern rõ.

- **Medium — `useExportPdf.fetchPdf` `await blob.text()` cho html_mock vẫn potential UTF-16 issue** nếu HTML content có non-ASCII characters (e.g. Vietnamese diacritics). Blob.text() dùng UTF-8 decoder default — Phase 27 không change semantics, nhưng nếu trader feedback "PDF preview text bị sai dấu", revisit. Hiện html_mock chỉ chứa English placeholder text.

- **Medium — `docs/DEPLOY.md` §2 quick start 8-step không có verification step.** Operator có thể skip step 6 (seed) → backend serve nhưng `/api/auth/login` reject (no user). Phase 28 add `docker compose exec backend python -m app.db.demo_seed --verify`.

- **Medium — `_warn_total_equity_range` test scenario "zero or negative" assert `"below sanity floor" not in caplog.text`** — assert KHÔNG warn cho zero/negative. Phải dùng `0 < val < floor` condition đã đúng. Test passes nhưng wording phải clear: "equity ≤ 0 không phải drift, là insolvent flag — `_compute_derived_fields` skip bvps fallback".

- **Low — `priceBoard.missingData` i18n VI text "{count} mã đang ẩn..."** — không match cluster 5 convention "mã" vs "ticker". Acceptable; trader Vietnamese reader hiểu ngay.

- **Low — `docker-compose.yml` healthcheck `python -c "import urllib.request..."` reuse Phase 18 Dockerfile.** Production nên dùng `wget --spider` hoặc `curl --fail` — không depend on Python interpreter. Defer.

- **Low — `script/nginx.conf` comment Vietnamese mix English** — readable nhưng inconsistent. Cosmetic. Defer.

## Đã kiểm chứng

- Đã đọc [Phase 19 REVIEW](../phase-19-playwright-smoke/REVIEW.md) Low finding "useExportPdf blob.text() avoid corrupt binary" — carry to Phase 27.
- Đã đọc [Phase 26 REVIEW](../phase-26-kbs-data-polish/REVIEW.md) High finding "_warn_total_equity_range analog" — implemented.
- Đã verify magic-byte logic: `await blob.slice(0,4).arrayBuffer() + TextDecoder('ascii').decode(head) === '%PDF'`. WeasyPrint output ALWAYS starts with `%PDF-1.x`; html_mock starts with `<` (HTML tags).
- Đã verify Playwright 8/8 vẫn pass với refactored useExportPdf — test 08 Export PDF triggers download xác nhận flow end-to-end.
- Đã verify TypeScript compile clean.
- Đã verify ruff clean.
- Đã verify docker-compose.yml YAML syntax (visual inspection — 3 service definition + healthcheck + volume).
- Đã verify nginx.conf — standard directives, no typo.
- 5 new equity sanity test pass:

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code

uv run pytest tests/unit/test_feature_sanity.py -v
# 11/11 passed (6 cũ + 5 mới Phase 27)

uv run pytest -q
# 304/304 expected

uv run ruff check app tests
# All checks passed
```

## Điểm làm tốt

- **Magic-byte detection cho `%PDF`** — robust hơn Content-Type header (BE intentionally trả `application/pdf` cho cả html_mock). 4-byte check minimal overhead, deterministic.
- **`previewBlob` cached cùng `previewHtml`** — `confirmDownload` dùng raw blob, KHÔNG reconstruct. Binary path không bao giờ qua text()-decode-cycle.
- **`_warn_total_equity_range` reuse `_TOTAL_ASSETS_SANITY_FLOOR_VND` constant** — DRY. Cùng 1e9 VND floor logic.
- **Equity warn message explicit mention "bvps fallback có thể sai 1000×"** — operator audit context, link với Phase 26 work.
- **`docs/DEPLOY.md` §6 production gaps** — explicit, document 8 thing KHÔNG ship. Tránh operator nghĩ Phase 27 là turnkey production.
- **docker-compose 3-service split** — backend Dockerfile (Phase 18 stable) + frontend npm-start (no build image) + nginx — minimal complexity cho 1-trader case.
- **nginx `/api/*` + `/_next/*` + `/` route order** — đúng Next.js App Router pattern. Static assets cached 1 year, dynamic routes proxy.
- **`priceBoard.missingData` placeholder count thay vì list** — privacy + concise. 1 line UX cue.

## Cần revisit

- **Phase 28 (optional, post-feedback hoặc post-deploy):**
  - Consolidate sanity guards vào 1 helper với multi-field check.
  - `useExportPdf` magic-byte check + size guard cho corrupt blob edge case.
  - docker-compose FE multistage Dockerfile nếu scale > 1 trader.
  - nginx rate-limit + `proxy_request_buffering` directives.
  - Cloudflare WAF rules template.
  - SSL cert auto-renewal systemd timer.
  - Secret manager integration (Vault / 1Password CLI binding).
  - Container registry CI/CD (ghcr.io / Docker Hub).
  - Observability: Prometheus + Grafana + Sentry FE.
  - Off-site backup (rsync S3/B2).
  - Turbopack migration (drop `--webpack`).
  - Vnstock paid API key support.
- **Operator action (Phase 27 ship + operator-deploy):**
  - Quyết định hosting + cấp SSL + edit `.env.production`.
  - `docker compose up -d` + first-boot seed + `script/pre-handoff-refresh.sh`.
  - Verify live deploy: health endpoint + login + 1 manual `/api/run` + Telegram broadcast.
  - Wire ngrok hoặc public domain → hand-off trader.
- **Live `docs/DEPLOY.md` validation** — sau khi 1 trader deploy thực, update §2 quick start với findings.
