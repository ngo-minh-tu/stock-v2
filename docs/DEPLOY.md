# Production Deploy Guide (Phase 27)

> Mục tiêu: cho phép operator tự host VN RE AI Screener production-like với 1 host
> + Docker + HTTPS reverse proxy. KHÔNG production-ready cho > 1 trader hoặc
> public release (cần WAF, secret manager, observability, autoscaling).

**Phase 27 ships baseline template only.** Operator quyết định hosting provider
+ SSL cert + secret manager based on deployment context. Documented gap dưới §6.

## 1. Tổng quan kiến trúc

```
                    ┌─────────────────────────────────────┐
                    │  HTTPS reverse proxy (nginx:1.27)   │
                    │  certs ở /etc/nginx/ssl             │
                    └─────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │ /api/*  /share/{token}        │ /  /_next/*
              ▼                                ▼
       ┌─────────────────┐             ┌─────────────────┐
       │ backend         │             │ frontend        │
       │ FastAPI uvicorn │             │ Next 16.2.6     │
       │ port 8000       │             │ port 3000       │
       └─────────────────┘             └─────────────────┘
              │
              ▼
       ┌────────────────┐
       │ SQLite volume  │
       │ prod-data:/app │
       │   /data/       │
       └────────────────┘
```

## 2. Quick start (Docker Compose — 1 host)

```bash
# 1. Clone repo + setup secrets
git clone https://github.com/<owner>/stock-v2.git /srv/stock-screener
cd /srv/stock-screener
cp mvp/code/env.production.example mvp/code/.env.production
${EDITOR:-vim} mvp/code/.env.production
# CRITICAL: set JWT_SECRET (openssl rand -hex 32), INITIAL_USER_PASSWORD,
# FRONTEND_ORIGIN, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.

# 2. SSL cert (Let's Encrypt)
mkdir -p script/ssl
# A — via certbot standalone:
certbot certonly --standalone -d screener.example.com
ln -sf /etc/letsencrypt/live/screener.example.com/fullchain.pem script/ssl/fullchain.pem
ln -sf /etc/letsencrypt/live/screener.example.com/privkey.pem script/ssl/privkey.pem
# B — Cloudflare proxy "Flexible" SSL: pass-through, no cert needed (giảm 1 step
# nhưng MITM-able from Cloudflare).

# 3. Edit nginx domain + reload
sed -i 's/screener.example.com/<your-domain>/g' script/nginx.conf

# 4. Frontend build
cd frontend
npm install
npm run build
cd ..

# 5. Up containers
docker compose up -d

# 6. First-boot seed
docker compose exec backend python -m app.db.seed

# 7. Verify health
curl -fsS https://<your-domain>/api/health
# {"success":true,"data":{"status":"ok","version":"0.1.0"}}
```

## 3. Operator cron job (daily refresh)

`script/cron-refresh.sh` đã sẵn từ Phase 18. Wire qua systemd timer hoặc cron:

```bash
# /etc/cron.d/screener
30 9 * * 1-5 root /srv/stock-screener/script/cron-refresh.sh
0  3 * * *   root /srv/stock-screener/script/backup-db.sh
```

Required env (`/etc/environment` hoặc systemd EnvironmentFile):
- `API_BASE=https://<your-domain>` (hoặc `http://localhost:8000` nếu chạy localhost).
- `API_PASSWORD` (single-user JWT login password).
- `LOG_FILE=/var/log/screener-refresh.log` (optional).

## 4. Pre-handoff trader (Phase 25 carry)

Trước khi share URL trader, operator chạy 1 lần `script/pre-handoff-refresh.sh`:

```bash
API_PASSWORD='<prod-user-password>' \
DB_PATH='/srv/stock-screener/data/prod-screener.db' \
APP_ENV=production \
bash script/pre-handoff-refresh.sh
```

Chi tiết outcome: [mvp/phases/phase-25-pre-handoff-ux-polish/SUMMARY.md](../mvp/phases/phase-25-pre-handoff-ux-polish/SUMMARY.md).

## 5. Disaster recovery

- **Backup** (Phase 18): `script/backup-db.sh` SQLite hot-backup API. WAL-safe khi uvicorn đang serve. Retention 14 ngày (override env `RETENTION_DAYS`).
- **Restore**: `script/restore-db.sh <backup-file>` — refuse khi uvicorn running (operator manual stop trước).
- **Database mode**: SQLite single-file. Volume `prod-data` mount qua docker-compose. Snapshot/clone qua `docker volume inspect`.

## 6. Production-ready gaps (KHÔNG ship Phase 27)

- **Secret manager integration** — `.env.production` chứa secrets dạng plaintext. Nên bind từ Vault / AWS Secrets Manager / 1Password CLI. Trader-handoff hiện acceptable (1 user, fixed credentials).
- **WAF / DDoS protection** — Cloudflare proxy nên enable basic WAF rules. Direct host expose có risk.
- **Observability** — chỉ có structlog ra stdout + `script/cron-refresh.sh` log. Production cần Prometheus + Grafana + Sentry (frontend error reporting). Phase 28+ nếu trader feedback.
- **Multi-instance** — SQLite single-writer; multi-replica gây WAL conflict. Cần migrate sang Postgres trước scale > 1 instance (TAD g03 §C migration plan).
- **Auto-renewal SSL cert** — certbot renewal cần wire systemd timer + nginx reload. Phase 28 thêm nếu cần.
- **Container image registry** — `Dockerfile` build local; production CI nên push lên ghcr.io / Docker Hub + signed images. Phase 28 nếu deploy lên cluster.
- **Backup off-site** — `script/backup-db.sh` chỉ lưu local `backups/`. Cần rsync sang S3/B2 cho disaster recovery.
- **Vnstock paid API key** (Insiders) — `VNSTOCK_API_KEY` env hiện chưa support. Phase 28 add nếu trader cần refresh nhanh hơn 22 phút.

Closed 2026-05-24: Turbopack migration. `frontend/package.json` now uses `next dev` / `next build` without `--webpack`; production build 14 routes passed on Next 16.2.6.
