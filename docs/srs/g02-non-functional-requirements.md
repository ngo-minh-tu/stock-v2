---
name: Non-Functional Requirements
description: Non-Functional Acceptance Criteria (AC-NF-*) cho Performance, Reliability, Security, Auditability, Data Quality, Explainability của toàn hệ thống.
type: global
source: SRS §24
---

# G02 — Non-Functional Acceptance Criteria

> Parent: [00-system-overview.md](00-system-overview.md)

| NFR Category | AC ID | Criteria | Testable |
|---|---|---|---|
| Performance | AC-NF-01 | Full run < 5 phút (81 mã + 38 features) | Yes, time assertion |
| Performance | AC-NF-02 | Dashboard load < 3s | Yes, time assertion |
| Reliability | AC-NF-03 | ≥95% runs complete without crash (over 20 test runs) | Yes, batch test |
| Reliability | AC-NF-04 | vnstock fallback to cache within 2s | Yes |
| Security | AC-NF-05 | Password not stored plaintext (verify DB) | Yes, DB assertion |
| Security | AC-NF-06 | All routes require auth (except /login) | Yes, route test |
| Auditability | AC-NF-07 | Every run record has model_version + settings_version | Yes, DB assertion |
| Auditability | AC-NF-08 | Every reason traceable to feature ID or risk flag | Yes, parse test |
| Data Quality | AC-NF-09 | ≥80% whitelist mã có thể scoring (data coverage) | Yes, count test |
| Explainability | AC-NF-10 | ≥90% mã MUA có ≥3 valid reasons | Yes, count test |
