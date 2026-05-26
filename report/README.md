# Quy ước tổ chức report

Từ 2026-05-18, report phải được tổ chức theo folder chủ đề, không đặt file lẻ trực tiếp dưới `report/` nếu không có lý do đặc biệt.

**2026-05-20:** Backfill toàn bộ Phase 1-11 + Phase 19-20 vào `phase-mvp/`. Mỗi phase có 1 file `SUMMARY.md` tiếng Việt (user-facing log). Audit trail engineering vẫn nằm ở `mvp/phases/<phase>/SUMMARY.md` (9-section) + `mvp/phases/<phase>/REVIEW.md` (Codex 2nd-opinion).

**2026-05-24:** Mở rộng table tới Phase 28 (Mốc 4 + Track 1+2+3+4+5+6 đóng) + post-Phase deferral closure.

## Cấu trúc hiện tại

| Folder | Nội dung |
|---|---|
| `cluster-prompts/` | Báo cáo các cluster 1-6 từ giai đoạn prototype |
| `mvp-build/` | Tổng hợp build MVP, drift register, backlog (refreshed 2026-05-24 cho Phase 0-28) |
| `phase-mvp/phase-1-db-constants-seed/` | DB + Constants + Seed (16 tables, 81 stocks, 150 news fixture) |
| `phase-mvp/phase-2-auth-settings/` | Auth login + PUT password + Settings GET/PUT |
| `phase-mvp/phase-3-refresh-layer/` | vnstock_client + cache_manager + /refresh/{all,prices} async |
| `phase-mvp/phase-4-engines-features-risk/` | 4-round filter + 38 features + scoring/price/entry baseline + risk service |
| `phase-mvp/phase-5-screening-orchestrator/` | /api/run + job_lock 409 + screening pipeline + bulk insert |
| `phase-mvp/phase-6-read-apis/` | Dashboard + results + stock detail + compare + excluded + price board + news |
| `phase-mvp/phase-7-personal-history/` | Portfolio CRUD + DELETE /runs + compare 4-section |
| `phase-mvp/phase-8-backtest-export-share-telegram/` | Backtest 2-stage + WeasyPrint + Share token + Telegram test |
| `phase-mvp/phase-9-fe-swap/` | FE swap MSW → real backend + schema reconcile |
| `phase-mvp/phase-10-integration-qa/` | AC checklist 17 SRS files + bug fixes |
| `phase-mvp/phase-11-readme/` | mvp/README.md + root README + frontend/README.md |
| `phase-mvp/phase-12-production-data-qa/` | QA dữ liệu production lần đầu (vnstock quota, SystemExit boundary) |
| `phase-mvp/phase-13-demo-stability/` | **Mốc 1**: tách DB test/demo, demo seed ổn định |
| `phase-mvp/phase-14-production-data-hardening/` | **Mốc 2** (prices code): harden refresh, partial commit, resume failed |
| `phase-mvp/phase-15-financial-ingestion/` | **Mốc 2** (BCTC code): vnstock.api.financial.Finance + upsert |
| `phase-mvp/phase-16-mvp-data-readiness-closure/` | **Mốc 2 đóng thật**: scale unit fix + MOCK filter + FRESH cache |
| `phase-mvp/phase-17-financial-source-fallback/` | **Mốc 3 step 1**: VCI → KBS fallback chain |
| `phase-mvp/phase-18-mvp-release-hardening/` | **Mốc 3 steps 2-7**: per-call gating + prod env + backup/restore/cron + security audit |
| `phase-mvp/phase-19-playwright-smoke/` | **Mốc 3 step 8**: Playwright critical-path 8/8 + 4 bug production fix |
| `phase-mvp/phase-20-telegram-real-send-verify/` | **Mốc 3 step 9**: Telegram real-send end-to-end + gitignored secret convention |
| `phase-mvp/phase-21-financial-quality-no-downgrade/` | **Mốc 4 step 1**: KBS parser + COALESCE no-downgrade upsert + multi-source merge VCI+KBS |
| `phase-mvp/phase-22-financial-unit-scaling/` | **Mốc 4 step 2**: VCI raw / KBS ×1000 source-aware scaling + production secret guard; NLG khớp CafeF |
| `phase-mvp/phase-23-telegram-broadcast-config-env/` | **Track 2**: `broadcast_run_summary` wired vào screening finalize + 10-test config_env_chain pytest |
| `phase-mvp/phase-24-fe-next16-security-upgrade/` | **Track 1**: Next 14.2.15 → 16.2.6 + next-intl 4.12.0 + eslint 9; ngrok hand-off blocker cleared |
| `phase-mvp/phase-25-pre-handoff-ux-polish/` | **Track 5**: FE schema `latest_price`→`latest` rename + 3 disclaimer banner + `script/pre-handoff-refresh.sh` + total_assets sanity guard |
| `phase-mvp/phase-26-kbs-data-polish/` | **Track 3**: bvps fallback + period suffix lock + KBS snapshot 13-field golden regression |
| `phase-mvp/phase-27-deploy-polish/` | **Track 4 baseline**: `useExportPdf` binary-safe + PriceBoard placeholder + equity sanity guard + `docker-compose.yml` + nginx + `docs/DEPLOY.md` |
| `phase-mvp/phase-28-polish-batch/` | **Track 6**: InfoBanner dismiss + Telegram 429 retry + sanity consolidate + prod guard extensible + period suffix log DEBUG + test flake fix |

## Quy tắc thêm report mới

- Các phase sau MVP nằm dưới `report/phase-mvp/<phase-name>/`, ví dụ `report/phase-mvp/phase-14-production-data-hardening/`.
- Mỗi folder phase **chỉ có file `SUMMARY.md`** (user-facing log tiếng Việt). REVIEW (Codex 2nd-opinion) sống ở `mvp/phases/<phase>/REVIEW.md`, KHÔNG mirror sang đây.
- Cấu trúc 6 section: §1 Việc đã làm · §2 File đã thêm · §3 File đã sửa · §4 Lệnh đã chạy · §5 Kết quả · §6 Tồn đọng.
- Report mới viết bằng tiếng Việt.
- Khi di chuyển report, cập nhật link trong README, phase docs và các báo cáo liên quan.
- Không trộn report của nhiều mục vào một file tổng nếu mục đó có lifecycle riêng.
- **Security:** report KHÔNG được chứa numeric chat_id, bot id, token prefix, hoặc PII khác — chỉ tham chiếu gitignored secret file.
