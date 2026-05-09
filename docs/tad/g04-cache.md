---
id: g04
title: Cache Architecture — Source-level TTL, Staleness, vnstock Rate Limit
parent: 00-tad-system-overview.md
type: global
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§9)
---

# g04 — Cache Architecture

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)
>
> MVP cache granularity = source-level (NOT ticker-level). All ~81 tickers share the same TTL per source. Post-MVP: nâng lên ticker-level nếu cần refresh từng mã riêng.

---

## 1. Cache Keys & TTL

| Cache Key | TTL | Description |
|---|---|---|
| VNSTOCK_PRICES | 4h (phiên) / 24h (ngoài) | Giá tất cả ~81 mã |
| VNSTOCK_FINANCIALS | 30 ngày | BCTC tất cả mã |
| MACRO_SBV | 30 ngày | Lãi suất, tín dụng BĐS |
| MACRO_GSO | 30 ngày | CPI, FDI |
| NEWS_CAFEF | 6h | Tin CafeF |
| NEWS_VNEXPRESS | 6h | Tin VnExpress |
| NEWS_VIETSTOCK | 6h | Tin Vietstock |
| NEWS_BATDONGSAN | 6h | Tin Batdongsan |
| NEWS_THANHNIEN | 6h | Tin Thanh Niên |

---

## 2. Staleness Check

```python
def is_stale(source: str) -> bool:
    meta = db.get(cache_metadata, source)
    if not meta or not meta.last_refreshed_at:
        return True
    elapsed = now() - meta.last_refreshed_at
    return elapsed.total_seconds() > meta.ttl_hours * 3600
```

---

## 3. vnstock Rate Limit

```python
VNSTOCK_DELAY_SECONDS = 0.5
# Delay 0.5s between each API call to vnstock
```
