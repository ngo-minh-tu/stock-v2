---
name: Global Errors & Validation Rules
description: Global error states (ERR-*) cross-cutting nhiều module và global data validation rules áp dụng cho mọi field type trong hệ thống.
type: global
source: SRS §22 + §23
---

# G01 — Global Errors & Validation Rules

> Parent: [00-system-overview.md](00-system-overview.md)

## 1. Global Error States

| Error ID | Module | Condition | User Message (VIE) | System Action |
|---|---|---|---|---|
| ERR-01-01 | Screening | vnstock down + no cache | "Không thể kết nối vnstock và không có dữ liệu cache" | Run fail, log error |
| ERR-01-02 | Screening | 0 mã qua lọc | "Không có mã nào đủ điều kiện phân tích" | Show empty results |
| ERR-01-03 | Screening | AI Engine crash | (internal) | Fallback baseline, log |
| ERR-10-01 | News | All 5 sources down | "Không thể crawl tin tức từ bất kỳ nguồn nào" | Sentiment = NEUTRAL all |
| ERR-10-02 | News | 1-4 sources down | (silent) | Skip failed, crawl rest, log |
| ERR-14-01 | Telegram | API error | (silent to user) | telegram_sent=false, log |
| ERR-14-02 | Telegram | Invalid chat_id/token | "Telegram chat_id hoặc token không hợp lệ" | Show in Settings |

## 2. Global Data Validation Rules

| Field Type | Rule | Error |
|---|---|---|
| ticker | Uppercase, 1-5 chars, letters only | "Mã không hợp lệ" |
| price | > 0 | "Giá phải > 0" |
| quantity | Integer > 0 | "Số lượng phải > 0" |
| ai_score | 0-100, clamp if outside | Log if >3σ outlier |
| confidence | 0-100 after penalty, floor 0 | Never negative |
| sentiment_score | -1.0 to +1.0 | Clamp if outside |
| date | ISO 8601 format | "Ngày không hợp lệ" |
| capital | ≥ 0, integer | "Vốn phải ≥ 0" |
