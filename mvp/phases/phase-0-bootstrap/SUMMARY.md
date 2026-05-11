# Phase 0 — Bootstrap

**Status:** COMPLETED 2026-05-10
**Estimate vs actual:** 1d / ~2h
**Spec ref:** [PLAN.md §3 row 0](../../PLAN.md)

## 1. Scope

- Tạo skeleton backend `mvp/`
- Setup uv + pyproject.toml + lockfile
- FastAPI app shell với /api/health + /api/version (envelope chuẩn TAD g02 §6)
- Alembic init + wire DB URL từ `app.config` (chưa có migration thật — Phase 1)
- pytest skeleton + 2 integration tests
- Dockerfile multi-stage + entrypoint script
- CORS allow `http://localhost:3000`
- KHÔNG viết README (Phase 11)

## 2. Deliverables

Tất cả path dưới đây relative tới `mvp/code/`.

| Path | Mục đích |
|---|---|
| `pyproject.toml` | uv-managed deps; ruff + pytest config |
| `uv.lock` | Locked deps (commit vào git) |
| `.python-version` | 3.11 |
| `.env.example` | Full env vars template (DB_PATH, JWT_SECRET, FRONTEND_ORIGIN, ...) |
| `.gitignore` / `.dockerignore` | Standard Python ignores + `.venv/` + `data/` |
| `Dockerfile` | Multi-stage builder + runtime; uv 0.11; WeasyPrint native libs; non-root |
| `entrypoint.sh` | `mkdir data` → `alembic upgrade head` → `uvicorn` |
| `app/__init__.py` | Package marker |
| `app/main.py` | FastAPI factory + CORS + exception handlers + router mount |
| `app/config.py` | Pydantic Settings từ env (`get_settings()` cached) |
| `app/core/envelope.py` | `success()` / `error()` helpers |
| `app/core/errors.py` | `AppError` + 4 exception handlers (AppError, validation, HTTP, generic) |
| `app/api/__init__.py` | Router với prefix `/api` |
| `app/api/health.py` | GET /health + GET /version |
| `alembic.ini` + `alembic/env.py` | Alembic config wired vào `app.config.get_settings().database_url` |
| `alembic/script.py.mako` | Default revision template |
| `tests/__init__.py` + `tests/integration/__init__.py` | Package markers |
| `tests/conftest.py` | `TestClient` fixture |
| `tests/integration/test_health.py` | 2 test cases (envelope shape) |

## 3. Exit criteria — all PASS

- `uv sync` xong, `.venv/` + `uv.lock` tạo (~80 packages)
- `uv run pytest` → **2/2 pass**
- `uv run ruff check app tests` → **All checks passed**
- `uv run uvicorn app.main:app` start không lỗi
- `curl http://127.0.0.1:8000/api/health` → `{"success":true,"data":{"status":"ok","active_job":null}}`
- `curl http://127.0.0.1:8000/api/version` → envelope với `app_version=0.1.0`, `prd_version=v0.5A`, `srs_version=v1.4`, `tad_version=v1.5`, `model_version=baseline_v2`, `db_tables=16`
- `uv run alembic upgrade head` connect SQLite OK (no migrations yet — expected)

## 4. Quyết định khoá trong phase này

| Mục | Giá trị |
|---|---|
| uv version | Docker `ghcr.io/astral-sh/uv:0.11`; local 0.11.12 (Homebrew) |
| Python | `>=3.11,<3.12` |
| ML deps | KHÔNG add scikit-learn/xgboost/tensorflow — engines stub-only trong MVP, add ở phase post-MVP khi train ML |
| News deps | KHÔNG add feedparser/beautifulsoup4 — news = fixture loader (Phase 1 seed 150 articles) |
| SQLite path | `/app/data/screener.db` (container, volume mount) · `./data/screener.db` (local) |
| Migration timing | Container entrypoint chạy `alembic upgrade head` rồi mới `uvicorn` (MVP only) |
| Test framework | pytest thuần + FastAPI `TestClient` sync |
| Linter | ruff (replace flake8/black/isort) |

## 5. Issues / drift

- **Local dev warning** — Mỗi `uv run` show `VIRTUAL_ENV=/usr/local/opt/python@3.11/... does not match .venv` do Homebrew shell pre-activate. Vô hại; uv vẫn dùng `.venv` đúng. Workaround: `unset VIRTUAL_ENV` trong shell rc nếu phiền.
- `alembic/versions/` rỗng — Phase 1 sẽ tạo `0001_initial_schema.py` cho 16 bảng.
- Dockerfile chưa build/test thực — chỉ verify shape + runtime path. Phase 0 không yêu cầu container chạy được; Phase 1+ có thể test build.

## 6. Test commands (reproducible)

```bash
cd mvp/code
uv sync
uv run ruff check app tests
uv run pytest

# Smoke /health + /version
uv run uvicorn app.main:app --port 8000   # terminal 1
curl http://127.0.0.1:8000/api/health      # terminal 2
curl http://127.0.0.1:8000/api/version

# Alembic boot test
uv run alembic upgrade head
```

## 7. Hand-off cho Phase 1

Phase 1 sẽ thêm:
- `app/models/` — SQLAlchemy ORM cho 16 bảng (TAD g03)
- `app/db/session.py` — engine + SessionLocal + `get_db()` dependency
- `app/db/pragmas.py` — WAL + foreign_keys + busy_timeout
- `app/db/seed.py` — whitelist 81 + default settings + 1 user + 150 news
- `app/constants/` — enums, features (38 IDs + normalization), thresholds, reason_codes, error_codes
- `app/repositories/` — bắt đầu với `stock_repo.py`, `settings_repo.py`, `user_repo.py`
- `alembic/versions/0001_initial_schema.py` — autogenerate từ Base.metadata
- Update `alembic/env.py`: `target_metadata = None` → `Base.metadata` (từ `app.models`)

## 8. Post-phase fixes

*(append entry mỗi khi user request fix Phase 0 sau khi phase đã đóng — theo memory rule "Post-cluster fix logging")*
