# Phase 29 — Post-handoff Backlog (Trader Audit · Deploy Infra · Scale Prep · Tech Debt)

**Trạng thái:** 📋 BACKLOG — **chưa mở**. Đợi trigger từ trader feedback hoặc quyết định production deploy.
**Người tạo:** PO (Ngô Minh Tú), 2026-05-22 sau khi Phase 28 đóng.
**Liên quan:** [mvp/phases/phase-28-polish-batch/SUMMARY.md](../phase-28-polish-batch/SUMMARY.md) · [plan/PLAN.md](../../../plan/PLAN.md) · memory `phase-24-plus-handoff-roadmap` §"Phase 29+ Optional".

---

## 1. Lý do mở Phase 29 (Why)

Phase 0-28 đã đóng toàn bộ Mốc 1+2+3+4 và Track 1-6. 311/311 BE pytest pass, Playwright 8/8, Next 16.2.6 + next-intl 4.12.0, real NLG financial data, Telegram broadcast wired, KBS snapshot regression guard, 3 disclaimer banner + dismiss + LocalStorage. **MVP đã sẵn sàng hand-off cho trader qua ngrok** (theo locked decision: single-user, không production deploy đầu tiên).

Phase 29 **KHÔNG mở ngay** vì 3 lý do:

1. **Trader feedback chưa về.** 3 hạng mục "Trader audit" (bvps adjustment / KBS OCF Q1 / sanity extend) chỉ có giá trị khi trader đã so sánh data thật với CafeF/Vietstock và chỉ ra cụ thể field nào lệch và lệch ở mức nào. Mở trước khi có signal = guess-work, risk làm sai hướng.
2. **Deploy infra chưa cần thiết.** ngrok đủ cho 1 trader test. Container registry / observability / WAF / SSL auto-renew / backup off-site chỉ cần khi quyết định scale > 1 tester hoặc public release. Mở trước = over-engineering.
3. **Tech debt có ROI thấp ở thời điểm này.** Turbopack defer vì `--webpack` stable; `_FIELD_BLOCKLIST` 4 entries hiện manageable (chưa chạm threshold >10); VCI mature chưa có drift signal; vnstock paid API key cần trader cost-benefit signal.

**Trigger mở Phase 29:**
- ✅ Trader gửi feedback list cụ thể (ticker X field Y lệch Z%) → mở Track 1 (Trader audit).
- ✅ PO quyết định scale > ngrok (multi-tester / public release) → mở Track 2 + 3 (Deploy infra + Scale prep).
- ✅ Tech debt signal cụ thể (FE perf complaint / blocklist >10 / VCI drift detected) → mở Track 4 (Tech debt) selectively.

**KHÔNG trigger nào trên → không mở Phase 29.** File này tồn tại chỉ để snapshot scope, không phải để chạy.

---

## 2. Track 1 — Trader audit feedback

**Mở khi:** Trader trả về list cụ thể "ticker X field Y lệch CafeF Z%".

| # | Hạng mục | Scope | File ảnh hưởng |
|---|---|---|---|
| 1.1 | **bvps adjustment** | Hiện bvps = `total_equity / shares_outstanding` (Phase 26 fallback). Adjust theo chuẩn kế toán: subtract preferred-stock equity, add-back treasury-stock. Cần lấy thêm `preferred_stock_capital` + `treasury_stock` từ vnstock balance-sheet. | `mvp/code/app/crawlers/vnstock_client.py` (`_compute_derived_fields`) · `mvp/code/app/models/financial.py` (nếu cần field mới) · alembic migration |
| 1.2 | **KBS OCF Q1 gap workaround** | KBS quarterly OCF có gap Q1 (vnstock community-tier hạn chế). Workaround: ước lượng từ `net_income + non_cash_items` hoặc rolling annual proxy. Cần trader xác nhận acceptable proxy. | `mvp/code/app/crawlers/vnstock_client.py` |
| 1.3 | **`_SANITY_VND_FIELDS` extend** | Phase 28 đã extensible. Add field mới sau khi trader chỉ ra unit-mismatch trên field ngoài `total_assets/total_equity` (vd `total_debt`, `revenue`, `net_income`). | `mvp/code/app/services/feature_service.py` |

**Exit criteria Track 1:**
- Trader xác nhận field đã match CafeF/Vietstock trong threshold ±5% (hoặc threshold trader chọn).
- 26/26 ticker đủ field sau refresh.
- Unit test cho mỗi adjustment rule.

---

## 3. Track 2 — Deploy infra

**Mở khi:** PO quyết định scale > ngrok (multi-tester / public release / SLA commit).

| # | Hạng mục | Scope | Phụ thuộc |
|---|---|---|---|
| 2.1 | **Container registry CI/CD** | Push image lên `ghcr.io` hoặc Docker Hub qua GitHub Actions. Tag = git SHA + semantic version. | Phase 27 đã có Dockerfile + docker-compose template. Chỉ wire CI. |
| 2.2 | **Observability** | Prometheus (BE metrics) + Grafana (dashboard) + Sentry (FE error tracking). Alert rules cho 5xx rate + refresh job failure. | Chọn hosting tier (self-host Grafana Cloud / Sentry SaaS). |
| 2.3 | **WAF rules** | Cloudflare hoặc tương đương. Rate-limit `/api/auth/login` (brute-force defense) + `/api/run` (DoS). Geo-block nếu cần. | DNS qua Cloudflare. |
| 2.4 | **SSL cert auto-renewal** | systemd timer + certbot (Let's Encrypt). Hoặc Cloudflare Origin Cert (90d). | Hosting có shell access. |
| 2.5 | **Container security scanning** | Trivy hoặc Snyk scan image trong CI pre-push. Fail build khi có HIGH/CRITICAL CVE. | CI pipeline. |
| 2.6 | **Backup off-site** | Phase 18 đã có `script/backup-db.sh` local. Add rsync → S3 / Backblaze B2 hằng đêm. Retention 30d. | S3/B2 credential. |

**Exit criteria Track 2:**
- Deploy production từ git push tự động (CI/CD green).
- Grafana dashboard show p95 latency + 5xx rate + refresh job last-success timestamp.
- WAF block bot scan log > 0 trong 7d.
- Cert auto-renew test (force expire 1 cert, verify renew).
- Backup off-site verify (restore từ S3 thành công).

---

## 4. Track 3 — Scale prep

**Mở khi:** Production load > 1 user concurrent hoặc PO commit multi-tenant.

| # | Hạng mục | Scope | Risk |
|---|---|---|---|
| 3.1 | **Postgres migration** | SQLite → Postgres. Alembic migration đã sẵn structure. Cần data migration script (export SQLite → COPY Postgres) + connection pool config. | Hot-path query (screening + dashboard) cần index review. |
| 3.2 | **Async Telegram retry queue** | Phase 28 đã có 1-shot retry on 429. Multi-user multi-broadcast cần persistent queue (Redis / Postgres LISTEN-NOTIFY) + dead-letter table. | Bot API rate-limit (30 msg/sec global) — cần global rate-limiter. |
| 3.3 | **Banner storageKey version policy doc** | Phase 28 đã version `dashboard-disclaimer-v1` etc. Document khi nào bump version (text change đáng kể / surface lại cho dismissed users). | Risk: bump version vô tội vạ làm user "spam dismiss". |

**Exit criteria Track 3:**
- Load test 10 concurrent user, p95 < 1s, no DB lock error.
- Telegram queue durable qua container restart.
- `docs/banner-version-policy.md` published.

---

## 5. Track 4 — Tech debt (selective)

**Mở khi:** Có signal cụ thể cho từng item. KHÔNG mở batch — pick theo ROI.

| # | Hạng mục | Trigger | Effort |
|---|---|---|---|
| 4.1 | **Turbopack migration** | FE build > 30s / dev server slow / Next 17+ require Turbopack. | ~0.5d |
| 4.2 | **`_FIELD_BLOCKLIST` → allowlist refactor** | Blocklist > 10 entries hoặc thêm > 2 entries/quarter. | ~0.3d |
| 4.3 | **VCI snapshot fixture** | Drift signal từ VCI source (test fail / output mismatch). | ~0.5d |
| 4.4 | **Backward-compat sanity wrappers cleanup** | External callers migrated tới `_warn_all_sanity_fields`. Phase 28 left wrappers cho safety. | ~0.2d |
| 4.5 | **`test_compare` round-trip consistency root fix** | Phase 28 band-aid tolerance 0.01→0.011. Root fix: dùng cùng rounding precision FE+BE compute path. | ~0.5d |
| 4.6 | **InfoBanner aria-label i18n + FOUC mitigation** | A11y audit feedback hoặc FOUC visible trên slow connection. | ~0.3d |
| 4.7 | **Period suffix structured log tag** | Operator audit cần grep tag, hiện log raw text khó query. Bump DEBUG → structured với `extra={"event": "period_suffix_collision"}`. | ~0.2d |
| 4.8 | **vnstock paid API key** | Refresh job 22m → ~3m. Trader cost-benefit: paid tier giá vs. time saved. | ~0.3d code + cost decision |

**Exit criteria Track 4 (per-item):**
- Item-specific test pass.
- Memory + relevant SUMMARY updated.
- KHÔNG batch tất cả — mỗi item là mini-phase con với riêng exit criteria.

---

## 6. Order of execution gợi ý

Khi mở Phase 29, **KHÔNG chạy hết 4 track**. Chọn theo trigger thực tế:

1. **Trader feedback về** → Track 1 only (1-3 ngày tuỳ scope feedback).
2. **Trader OK + PO decide scale** → Track 2 + Track 3.1 (Postgres) + Track 3.2 (queue). ~3-5 ngày.
3. **Tech debt signal** → Track 4 cherry-pick item theo ROI. ~0.2-0.5d/item.

**Tổng max nếu chạy hết:** ~7-10 ngày. Nhưng realistic: pick 2-3 item Track 1 sau feedback, đủ cho hand-off iteration kế tiếp.

---

## 7. Phase 29 artifacts khi mở

Theo rule `feedback_phase_3_artifact_rule` — khi đóng phase phải có:
- `mvp/phases/phase-29-{slug}/SUMMARY.md` (tech log, có drift audit §2)
- `mvp/phases/phase-29-{slug}/REVIEW.md` (self-critical)
- `report/phase-mvp/phase-29-{slug}/SUMMARY.md` (VN user-facing)
- Update `plan/PLAN.md` row + memory `phase-24-plus-handoff-roadmap`.

**Lưu ý slug:** nếu chỉ chạy 1 track, đặt slug theo track (vd `phase-29-trader-audit-bvps`). Nếu batch 2+ track, dùng `phase-29-post-handoff-batch`.

---

## 8. Related context

- [memory: phase-24-plus-handoff-roadmap §"Phase 29+ Optional"](file:///Users/ngominhtu/.claude/projects/-Users-ngominhtu-Projects-stock-v2/memory/project_phase24_plus_roadmap.md) — original source of this backlog (lines 218-247).
- [plan/PLAN.md](../../../plan/PLAN.md) — overall PLAN, sẽ add row Phase 29 khi mở.
- [mvp/phases/phase-28-polish-batch/SUMMARY.md](../phase-28-polish-batch/SUMMARY.md) — Phase 28 close-out + REVIEW backlog carry-over.
- [mvp/phases/phase-27-deploy-polish/SUMMARY.md](../phase-27-deploy-polish/SUMMARY.md) — `docker-compose.yml` + `nginx.conf` + `docs/DEPLOY.md` đã sẵn cho Track 2.
- [mvp/phases/phase-26-kbs-data-polish/SUMMARY.md](../phase-26-kbs-data-polish/SUMMARY.md) — bvps fallback baseline cho Track 1.1.