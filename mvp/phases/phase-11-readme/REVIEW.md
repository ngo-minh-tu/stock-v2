# Phase 11 — README REVIEW

**Done:** 2026-05-11 (~1h, estimate 0.5d — under-run vì 3 README parallel write thay vì sequential; smoke test commands chạy 1 lần verify cả 3)
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Retrospective focus: PLAN scope chỉ 1 file (mvp/README.md), user expand → 3 files. Trade-off "PLAN strict vs onboarding UX" — chốt expand cho monorepo 4-surface. README write phải smoke test, không assume command từ PLAN spec đúng (PLAN ghi `poetry install` nhưng reality `uv sync`).

## Surprises / non-obvious

- **PLAN.md row 11 đã obsolete partially**: PLAN ghi "poetry install, alembic upgrade, seed, uvicorn run" — nhưng Phase 0 chốt uv 2026-05-10. README phải dùng `uv sync` + `uv run`. PLAN doc historical, không touch ngược. **Lesson: PLAN.md là build-time spec, post-build doc (README) phải follow reality, không PLAN.**
- **frontend/README cluster-1-era confused nhiều hơn empty**: Existing FE README phản ánh trạng thái cluster 1 (Shell + Foundation, 8 ComingSoon pages, MSW always-on). Sau cluster 2-6 + Phase 9 swap, README mismatch ~80% nội dung. **Patch không khả thi — phải replace toàn bộ.** Lesson: stale README tệ hơn no README vì người đọc tin nội dung sai.
- **`script/run-prototype.sh` vẫn trỏ `prototype/` (frozen 2026-05-08)**: Initial instinct: update script trỏ `frontend/`. Nhưng prototype frozen làm reference snapshot — script still useful khi cần xem UI cluster 1-6 state. Không touch. Document trong root README §2 rằng prototype = frozen.
- **Idempotent seed silent: "stocks already seeded; skipping"**: smoke verify seed lần 2 (Phase 0-10 đã seed) → log all "already seeded; skipping", seed_counts `{stocks: 0, settings: 0, ...}`. Behavior đúng nhưng user lần đầu chạy có thể nhầm "seed fail". README §2.4 nói rõ "idempotent — re-run an toàn".
- **README ~750 LOC total trải đều 3 file** vs PLAN spec "ngắn — chỉ những gì tester/dev cần". Justify: monorepo 4-surface inherently cần documentation surface area lớn hơn single-package. mvp/README 306 dòng vẫn "ngắn" cho 39 endpoints + Docker + troubleshooting. Cost-benefit: 1 lần đọc 15 phút mỗi dev mới vs lặp đi lặp lại hỏi.
- **Markdown link relative paths trickier hơn assume**: mvp/README.md link `../report/` (1 cấp lên), mvp/README link `../frontend/` (1 cấp lên), nhưng phase SUMMARY.md trong `mvp/phases/phase-N/` link `../../../report/` (3 cấp). VSCode extension context mandate relative links → phải pay attention depth. Cross-checked all links Phase 11 smoke test §4.
- **User edit `BA` → `Business-Analyst`**: Sau khi tôi Write root README, user proactively touch lên thay `BA: Claude AI` → `Business-Analyst: Claude AI`. System-reminder báo "intentional, don't revert". Lesson: viết tắt mơ hồ (BA = Business Analyst hay Bachelor of Arts?) → expand explicit.

## Key decisions (why)

- **Scope expand từ 1 file → 3 files**: User chốt option B. Cost: +20 phút. Benefit: dev/tester clone repo có entry point rõ ràng (root README → mvp/ hoặc frontend/), không phải tự navigate. Trade-off chấp nhận vì monorepo 4-surface (frontend + mvp + prototype + docs) không thể serve qua 1 README.
- **frontend/README replace, không patch**: 80% mismatch với reality. Patch sẽ tạo Frankenstein doc — mix cluster 1 prototype + Phase 9 swap, confusing. Replace toàn bộ với post-Phase 9 reality cleaner.
- **Tiếng Việt primary + technical terms English**: Match memory user profile + PLAN row 11 spec "Viết bằng tiếng Việt". Technical terms (`apiFetch`, `Pydantic`, `Bearer token`) giữ English vì là identifier code.
- **Endpoint examples = happy path đầy đủ (login → run → portfolio → share + PDF)**: Cover 80% case tester verify. Còn 20% explore qua FastAPI auto-docs `/docs` (Swagger UI built-in). Không cần list 39 endpoint với curl từng cái — cost > benefit.
- **Docker section trong mvp/README chỉ, không root**: Root README giữ quick-start tối giản (5 phút). Docker = backend ops concern, người cần Docker đã tới mvp/. Phân tách đúng audience.
- **Troubleshooting top 5 entries thực sự encountered**: DB locked (operational), fixture pollution (Phase 10 hit), vnstock fail (Phase 3 design), telegram empty (Phase 8 default), port conflict (basic). High-signal vì là pain points thực, không hypothetical.
- **PLAN.md không update ngược**: PLAN row 11 còn ghi "poetry install". README dùng `uv`. PLAN = historical build-time spec, README = current-state ops doc. Update PLAN sẽ rewrite lịch sử build → reject. Documented mismatch trong Phase 11 SUMMARY §2 #1.
- **Smoke test commands BEFORE commit README**: Phase 11 §4 verify thực sự chạy `uv sync` + `alembic upgrade` + `seed` + `uvicorn` + `curl health/version/login/pwd-change`. Không trust spec — verify reality match README claim. Cost: +5 phút, savings: zero "README says X but actually Y" support requests.
- **TAD §1 endpoint registry gap KHÔNG update Phase 11**: out of scope. Documented trong `report/mvp-build-summary.md §4.C` + Phase 6 SUMMARY drift carryover. Post-MVP TAD doc patch task.

## To revisit

- **Production deploy guide**: README chỉ cover local + Docker single-instance. Production cần: reverse proxy (nginx/Caddy) + Let's Encrypt + secrets management (Docker secrets / env file) + backup strategy SQLite WAL + monitoring (healthcheck logs, structlog stdout → centralized log). Post-MVP separate doc `docs/deploy.md`.
- **Telegram real-send setup guide**: README §3 env vars chỉ nói "TELEGRAM_BOT_TOKEN/CHAT_ID — để rỗng → telegram disabled". Cần guide user: tạo bot qua @BotFather, lấy chat_id qua getUpdates API, set qua /api/settings PUT. Post-MVP add troubleshooting section dedicated.
- **vnstock first-fetch verification**: README troubleshooting note "test mode dùng synthetic, không gọi vnstock thật" — production deploy lần đầu vẫn cần verify vnstock fetch real data cho 81 mã. Post-MVP add "production smoke test" section.
- **Diagram / architecture image**: README hiện text-only. Khi cần visual context (16-table ERD, request flow, layered pattern) link tới docs/design.md + docs/tad/. Post-MVP có thể inline 1 ASCII diagram quick request-flow trong mvp/README §1.
- **Backup/restore SQLite**: Production sẽ cần. README chưa cover `.backup` SQLite command, WAL checkpoint, restore from snapshot. Post-MVP.
- **Multi-environment env vars (.env.dev / .env.prod / .env.test)**: README chỉ assume `.env`. Production có thể cần separate. Post-MVP convention.
- **CHANGELOG.md hoặc release notes**: 11 phase audit trail tốt nhưng phân tán. Single CHANGELOG.md với version bump policy (semver?) sẽ giúp khi MVP ship lên production phase 1.0.0. Post-MVP.
- **README i18n**: Phase 11 viết tiếng Việt. Nếu cần handover cho dev quốc tế, English README riêng (README.en.md). Post-MVP demand-driven.
- **`prototype/` cleanup decision**: Frozen 2026-05-08 — nếu disk space / git history concern, có thể move `prototype/` sang separate archive repo + symlink. Hiện giữ trong monorepo OK. Post-MVP nếu cần.
- **CI/CD pipeline doc**: README §5 chỉ nói "uv run pytest" + "npx tsc". Không cover GitHub Actions / CircleCI setup. Phase 0 đã có CI workflow `uv run ruff check + uv run pytest`. Post-MVP document trong `.github/workflows/README.md` nếu pipeline grow.
