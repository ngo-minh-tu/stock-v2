---
name: SRS-16 Authentication
description: Basic Auth login với password hash, redirect Login nếu chưa đăng nhập, không lưu plaintext. Phase 2.
type: feature
module: SRS-16
prd_fr: FR-15
phase: 2
---

# F16 — Authentication

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f15-settings.md](f15-settings.md), [f13-export-share.md](f13-export-share.md)
> Related — global: [g02](g02-non-functional-requirements.md) (AC-NF-05 password not plaintext, AC-NF-06 auth required)

## UC-16-01: Login

### Input
password (plaintext qua HTTPS)

### Process
hash(password) == stored password_hash

### Output
session token hoặc error

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-16-01 | Password đúng → redirect Dashboard |
| AC-16-02 | Password sai → error message, không tiết lộ thông tin |
| AC-16-03 | Chưa login → mọi route redirect Login |
| AC-16-04 | Password KHÔNG lưu plaintext trong DB |
