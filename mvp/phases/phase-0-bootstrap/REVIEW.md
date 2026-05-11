# Phase 0 — Bootstrap REVIEW

**Done:** ~2026-05-10 (~3h, estimate 1d)
**SUMMARY:** [./SUMMARY.md](./SUMMARY.md)

Retrospective focus: insights *non-obvious* không có trong SUMMARY — surprises, gotchas, decisions worth remembering khi quay lại phase này.

## Surprises / non-obvious

- **passlib + bcrypt 4.x incompatibility**: `passlib[bcrypt]==1.7.4` crashes on import với bcrypt 4.x do `detect_wrap_bug()` check sai version. Solution: dùng `bcrypt>=4.0` direct, KHÔNG passlib wrapper. Drift này được lock cho toàn dự án — KHÔNG ai add lại passlib.
- **uv 0.11.x vs newer**: chốt pin Docker image `ghcr.io/astral-sh/uv:0.11`. uv 0.12+ thay đổi sync semantics — chưa test. Local Homebrew 0.11.12 verified.
- **`VIRTUAL_ENV` mismatch warning**: mỗi command `uv run` log warning `VIRTUAL_ENV does not match .venv` vì user có Python 3.11 system + .venv project. Acceptable noise — không break.
- **pytest sync TestClient đủ**: FastAPI BackgroundTasks tự await trong sync TestClient → KHÔNG cần pytest-asyncio + httpx async client. Phase 5+8 BG tests đều dùng pattern này. Production uvicorn behavior khác — BG truly async.

## Key decisions (why)

- **CORS hardcode `http://localhost:3000`**: Next.js default port. Override qua `FRONTEND_ORIGIN` env nếu prod. Phase 9 verified working với preflight.
- **README defer to Phase 11**: tránh maintenance drift khi spec thay đổi giữa các phase.
- **Single Dockerfile multi-stage uv**: avoid `pip install` slow. Build cache friendly.

## To revisit

- Phase 11 README cần curl examples đầy đủ cho 41 endpoints + env vars table.
- Docker image deploy chưa test ngoài local — Phase 10 nếu cần.
