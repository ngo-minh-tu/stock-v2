---
id: g07
title: Deployment & Environment, Migration Plan, Security
parent: 00-tad-system-overview.md
type: global
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§23, §25, §26)
---

# g07 — Deployment, Migration, Security

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)

---

## 1. Deployment & Environment

> [v1.1 SHOULD-FIX] Full .env.example

### 1.1 .env.example

```env
# Database
DATABASE_URL=sqlite:///./data/screener.db
SQLITE_BUSY_TIMEOUT_MS=30000

# Auth
SECRET_KEY=change-this-to-random-string
JWT_EXPIRY_HOURS=24
INITIAL_PASSWORD=change-this

# vnstock
VNSTOCK_DELAY_SECONDS=0.5
VNSTOCK_TIMEOUT_SECONDS=30

# Crawlers
NEWS_CRAWL_TIMEOUT_SECONDS=15
MACRO_CRAWL_TIMEOUT_SECONDS=15

# Telegram (optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_TIMEOUT_SECONDS=10

# Logging
LOG_LEVEL=INFO
LOG_FILE=logs/app.log

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000/api

# PDF
PDF_TEMPLATE_DIR=templates/pdf

# Model (Phase 2+)
MODEL_DIR=data/models
```

### 1.2 SQLite Startup Pragmas

Áp dụng khi khởi tạo DB connection (trong db/database.py):
```python
from sqlalchemy import event

@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute(f"PRAGMA busy_timeout={settings.SQLITE_BUSY_TIMEOUT_MS}")
    cursor.close()
```

### 1.3 SQLite Lock Timeout

> [v1.1 PATCH] Với SQLite WAL, cấu hình `busy_timeout` để giảm lỗi `database is locked` khi background task ghi dữ liệu hoặc khi backtest ghi nhiều rows.

**Environment variable:**
```env
SQLITE_BUSY_TIMEOUT_MS=30000
```

**Rules:**
- Không giữ DB transaction mở trong lúc crawl external sources, gọi model inference, hoặc generate PDF.
- Chỉ mở transaction khi thực sự đọc/ghi DB.
- Với backtest result writes, dùng batch insert theo batch nhỏ.
- Nếu SQLite lock vẫn xảy ra, trả lỗi rõ ràng và log `active_job` hiện tại.
- Nếu tần suất lock tăng khi mở rộng beta/multi-user, chuyển sang PostgreSQL theo Migration Plan.

### 1.4 Local Setup

```bash
# Backend
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # edit values
alembic upgrade head
python -m app.db.seed
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev  # port 3000

# ngrok
ngrok http 3000
```

---

## 2. Migration Plan: SQLite → PostgreSQL

1. Đổi DATABASE_URL sang PostgreSQL
2. Alembic auto-generate migration
3. TEXT → VARCHAR, *_json → JSONB
4. Add connection pooling (asyncpg)
5. SQLAlchemy 2.0 tương thích — không sửa ORM code

---

## 3. Security

| Area | MVP | Production |
|---|---|---|
| Auth | JWT + bcrypt | OAuth2 + refresh |
| HTTPS | ngrok provides | Nginx + cert |
| SQL Injection | SQLAlchemy ORM | Same |
| XSS | React auto-escapes | CSP headers |
| CORS | localhost only | Whitelist |
| Secrets | .env file | Vault |
