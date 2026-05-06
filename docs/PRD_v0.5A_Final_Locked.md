# PRODUCT REQUIREMENTS DOCUMENT
# VN REAL ESTATE AI SCREENER

> *Dữ liệu dẫn đường, quyết định thuộc về bạn*

**Version 0.5A — Final Locked**
All review issues resolved. Ready for SRS.

**Author:** Ngô Minh Tú
**|BA (Business Analyst):** Claude AI + ChatGPT
**|Date:** May 4, 2026

| Field | Details |
|---|---|
| Version | v0.5A — Final Locked |
| Changes from v0.5 | 8 fixes from 2nd review: Feature Dictionary corrected to 38, Entry priority order, Confidence penalty formula, Backtest correctness definition, Sentiment guardrail |
| Document Flow | **PRD v0.5A** → SRS → Technical Design Document |
| Score | 8.8/10 → targeting 9.1+/10 |
| Stage | MVP — Personal Use |

---

## Revision History

| Version | Date | Summary |
|---|---|---|
| v0.1 | 30/04 | 30 interview questions |
| v0.2 | 01/05 | 18 review issues resolved |
| v0.3.1 | 02/05 | Vibecoding guardrails, feature dictionary, deterministic entry logic |
| v0.4 | 03/05 | Consolidated: v0.3.1 kept + 18 v0.2 features restored + tech separated |
| v0.5 | 03/05 | 1st review (8 fixes) + Exec Summary enhanced + NFR + Feature Appendix |
| v0.5A | 04/05 | 2nd review (8 fixes): Feature Dict 38 corrected, Entry priority, Confidence formula, Backtest def, Sentiment guardrail. **LOCKED for SRS.** |

---

## 1. Executive Summary

### 1.1 Problem Statement

Nhà đầu tư cá nhân tại Việt Nam thường đầu tư cổ phiếu bất động sản theo cảm tính, thiếu hệ thống sàng lọc, thiếu khả năng đọc chart chuyên sâu, và khó tổng hợp đồng thời các yếu tố cơ bản, kỹ thuật, vĩ mô, pháp lý dự án và sentiment thị trường.

### 1.2 Solution

VN Real Estate AI Screener là web app sử dụng 2 model AI (XGBoost + LSTM) hỗ trợ phân tích và sàng lọc ~81 mã cổ phiếu BĐS thuần Việt Nam. MVP tập trung vào việc chạy sàng lọc thủ công, hiển thị tổng quan thị trường ngành, Top mã MUA, danh sách mã rủi ro, và giải thích lý do AI đưa ra khuyến nghị để người dùng tự kiểm chứng trước khi quyết định đầu tư. Hệ thống là "cánh tay đắc lực" phân tích A-Z, người dùng ra quyết định cuối cùng.

### 1.3 MVP Positioning

MVP ưu tiên personal-use cho Product Owner. Sản phẩm chưa tối ưu cho multi-user, monetization, mobile-first hoặc public launch. Tuy nhiên, cách tổ chức dữ liệu, UX và tài liệu vẫn giữ khả năng mở rộng để sau này có thể beta test với nhóm nhỏ.

### 1.4 Core Product Promise

Sản phẩm không thay người dùng ra quyết định đầu tư. Sản phẩm đóng vai trò trợ lý phân tích dữ liệu: lọc rủi ro, chấm điểm, giải thích, và đưa ra tín hiệu tham khảo.

### 1.5 Vision

- Giai đoạn 1: Công cụ cá nhân — tối ưu model qua backtest
- Giai đoạn 2: Ra thị trường phục vụ NĐT mới + NĐT kỳ cựu

---

## 2. Goals, Non-Goals & Principles

### 2.1 Goals

- Giúp chọn mã BĐS đáng cân nhắc mua, giải thích lý do.
- Giúp tránh mã rủi ro cao hoặc dữ liệu không tin cậy.
- Hỗ trợ quản lý rủi ro: stop loss, phân bổ vốn, cảnh báo.
- Theo dõi danh mục và đánh giá độ chính xác model.

### 2.2 Non-Goals (MVP)

- Không đặt lệnh tự động. Không tư vấn đầu tư chính thức. Không mobile-optimized. Không realtime. Không monetization/multi-user.

### 2.3 Product Principles

- **Simple first:** Chạy được > chạy đẹp. Baseline engine trước, tối ưu sau.
- **Explainable enough:** Mọi khuyến nghị có lý do kiểm chứng được.
- **Risk-first mindset:** Ưu tiên loại mã xấu hơn tìm mã tốt.
- **Manual control:** Người dùng bấm Chạy, kiểm tra, quyết định.

---

## 3. MVP Scope — Phased

### 3.1 MVP Core — Sản phẩm chạy được (Phase 1-2)

| Feature | Phase |
|---|---|
| Sàng lọc ~81 mã BĐS, 4 vòng lọc + AI Scoring | Phase 1 |
| XGBoost AI Score + LSTM target_price_3m (baseline allowed) | Phase 1 |
| 38 scoring features, 5 nhóm, trọng số 35/20/15/22/8 | Phase 1 |
| Walk-Forward Validation 4 đợt | Phase 1 |
| MUA/GIỮ/BÁN + % tin cậy + entry signal (7 enum) | Phase 1 |
| Login (Basic Auth) | Phase 2 |
| Dashboard (6 charts: Treemap, Pie, Line, Bar, Radar + KPIs) | Phase 2 |
| Top MUA list + tóm tắt lý do | Phase 2 |
| Red Flags + warning badges cho mã scored | Phase 2 |
| Stock Detail (Candlestick + Radar + breakdown + entry signal) | Phase 2 |
| Stop Loss -10% + phân bổ vốn theo AI Score | Phase 2 |
| Vibecoding Guardrails (8 rules) + Feature IDs | Phase 1-2 |

### 3.2 MVP Extended — Trải nghiệm đầy đủ (Phase 3)

| Feature |
|---|
| Bảng giá riêng (TanStack Table, ~81 mã) |
| Tin tức 5 nguồn + AI Sentiment + màn hình riêng |
| Portfolio Lite: CRUD danh mục + lãi/lỗ cơ bản |
| Lịch sử chạy + so sánh 2 runs |
| Telegram bot (bật/tắt, Top N, sau manual run) |
| PDF export cơ bản |

### 3.3 MVP Polish (Phase 4)

| Feature |
|---|
| 3 themes: Classic/Light/OLED + toggle Sáng/Tối cho Classic |
| Song ngữ VIE/ENG (next-intl) |
| Design.md SSI-inspired integration |
| Share link qua ngrok |
| Backtest Core: tỷ lệ đúng + sai số giá + ROI vs VN-Index (chưa tính phí) |
| Settings đầy đủ: themes, ngưỡng, nguồn tin, Telegram, MK |

### 3.4 Post-MVP

| Feature |
|---|
| Lịch sử giao dịch nâng cao + phân tích hiệu suất portfolio |
| Backtest Advanced: survivorship bias, transaction cost, slippage |
| Tần suất cảnh báo Telegram (cần scheduler) |
| OAuth / multi-user / monetization |
| Mobile-optimized |

---

## 4. AI Model Specification

### 4.1 Dual-Model Architecture

| Property | XGBoost | LSTM |
|---|---|---|
| Mục đích | Scoring + phân loại | Dự đoán giá |
| Output | AI Score 0-100 | target_price_3m |
| Confidence | predict_proba | N/A |
| Training | 2021-2026 (5 năm) | 2021-2026 |
| Validation | Walk-Forward 4 đợt | Walk-Forward 4 đợt |

**MVP Implementation Rule:** Interface bắt buộc tương thích XGBoost/LSTM. Nếu model chưa ổn, dùng Rule-Based Baseline Scoring Engine. UI/API output không thay đổi. XGBoost/LSTM required cho model track, nhưng không blocking UI MVP nếu baseline engine pass contract tests.

### 4.2 Scoring Features vs Raw Indicators

> [v0.5A FIX] Phân biệt rõ scoring features (input cho XGBoost) vs raw indicators (input cho Entry Point Logic)

**38 Scoring Features** (input cho XGBoost model):

Đây là 38 features duy nhất được dùng để tính AI Score. Xem chi tiết Appendix A.

| # | Nhóm | Count | Weight |
|---|---|---|---|
| 1 | Cơ bản (Ưu tiên) | 16 | 35% |
| 2 | Kỹ thuật | 9 | 20% |
| 3 | Vĩ mô | 5 | 15% |
| 4 | Đặc thù BĐS | 5 | 22% |
| 5 | Sentiment | 3 | 8% |
| | **Tổng** | **38** | **100%** |

**Raw Indicators** (KHÔNG phải scoring features, chỉ dùng cho Entry Point Logic):

SMA20, SMA50, SMA200, EMA12, EMA26, Bollinger Upper, Bollinger Lower, MACD Signal Line. Các raw indicators này được tính toán để phục vụ logic vào lệnh (Section 6), nhưng KHÔNG nằm trong 38 features đầu vào XGBoost.

### 4.3 Walk-Forward Validation

| Đợt | Train | Predict | Mục đích |
|---|---|---|---|
| 1 | 2021 → Q2/2024 | Q3/2024 | Kiểm tra đợt 1 |
| 2 | 2021 → Q4/2024 | Q1/2025 | Kiểm tra đợt 2 |
| 3 | 2021 → Q2/2025 | Q3/2025 | Kiểm tra đợt 3 |
| 4 | 2021 → Q4/2025 | Q1-Q2/2026 | Kiểm tra đợt 4 |
| REAL | 2021 → Q2/2026 | target_price_3m | Đầu tư thực |

### 4.4 Ngưỡng Khuyến Nghị

≥75 MUA | 45-74 GIỮ | <45 BÁN (tùy chỉnh trong Settings)

### 4.5 Recommendation Correctness Definition (cho Backtest)

> [v0.5A NEW] Định nghĩa "đúng" cho backtest

| Khuyến nghị | Đúng nếu | Sai nếu |
|---|---|---|
| MUA | 3M return > 0% VÀ outperform VN-Index | 3M return ≤ 0% HOẶC underperform VN-Index |
| GIỮ | 3M return trong khoảng -7% đến +12% | Ngoài khoảng -7% đến +12% |
| BÁN | 3M return < 0% HOẶC underperform VN-Index >5% | 3M return ≥ 0% VÀ không underperform >5% |

Biên GIỮ mở rộng hơn chuẩn (-7% đến +12%) vì cổ phiếu BĐS biến động mạnh hơn thị trường chung. Định nghĩa này là baseline, có thể tinh chỉnh sau khi có data backtest thực tế.

---

## 5. Screening Pipeline

| Vòng | Tiêu chí | Kết quả |
|---|---|---|
| 1: Red Flags | Hủy NL, C/W/X, D/E≥4, ROE<-20%, lỗ ≥3Q, kiểm toán. Mã mới <4Q → cảnh báo | Loại cực đoan |
| 2: Price | < 15.000đ | Loại penny |
| 3: Liquidity | KLGD TB 20p < 300K | Loại khó GD |
| 4: Data | Thiếu BCTC 4Q hoặc giá <6M | Loại thiếu data |
| 5: AI | XGBoost Score + LSTM Price + Entry Signal | MUA/GIỮ/BÁN |

---

## 6. Entry Point Logic

### 6.1 3 Tín hiệu

- **Valuation:** Giá vs NAV, upside vs target_price_3m
- **Technical:** RSI + Bollinger + MA20 + MACD (dùng raw indicators, không phải scoring features)
- **Support/Resistance:** Vùng S/R từ lịch sử giá

### 6.2 Priority Order

> [v0.5A NEW] Entry rules đánh giá theo thứ tự ưu tiên. First match wins.

```
Priority 1: INSUFFICIENT_DATA  → thiếu data thì dừng, không đoán
Priority 2: NO_ENTRY           → loại trước
Priority 3: BUY_STRONG         → tín hiệu mạnh nhất
Priority 4: BUY_NOW            → tín hiệu tích cực
Priority 5: WAIT_FOR_BREAKOUT  → chờ phá resistance
Priority 6: WAIT_FOR_PULLBACK  → chờ điều chỉnh
Priority 7: WAIT_FOR_CONFIRMATION → tín hiệu yếu nhất
```

### 6.3 7 Enum với Rule Cụ Thể

| Enum | Rule |
|---|---|
| INSUFFICIENT_DATA | Thiếu ≥2 raw technical indicators HOẶC không có NAV → không đoán (GUARD-04) |
| NO_ENTRY | rec=GIỮ hoặc BÁN, HOẶC rec=MUA nhưng RSI>70 + giá>Bollinger_upper |
| BUY_STRONG | rec=MUA + upside≥20% + giá<80%NAV + RSI<60 + giá>MA20 (bullish) + không overbought |
| BUY_NOW | rec=MUA + upside≥10% + (valuation_attractive HOẶC technical_bullish) |
| WAIT_FOR_BREAKOUT | rec=MUA + giá gần resistance + RSI 50-65 + chưa breakout → đợi phá resistance |
| WAIT_FOR_PULLBACK | rec=MUA + RSI>60 (hơi overbought) + upside OK → đợi về vùng support |
| WAIT_FOR_CONFIRMATION | rec=MUA + MACD chưa cắt signal + giá gần MA20 nhưng chưa vượt |

---

## 7. Functional Requirements

### 7.1 FR-01: Manual Screening Run
- Bấm Chạy → 4 vòng + AI Score + target_price + entry signal. Nhập tổng vốn thủ công.
- AC: Kết quả < 5 phút, lưu lịch sử, save model_version + settings_version.

### 7.2 FR-02: Dashboard / Market Overview
- Treemap ~81 mã + Pie MUA/GIỮ/BÁN + Line xu hướng + Bar chỉ số + Radar 5 nhóm + KPI cards

### 7.3 FR-03: Price Board
- Màn hình riêng, TanStack Table, ~81 mã, màu TTCK VN, sort/filter, click → Detail

### 7.4 FR-04: Top MUA List
- Mã MUA + score + tin cậy + upside + entry signal + tóm tắt 3-5 lý do
- Expand: stop loss + phân bổ vốn + warning badges

### 7.5 FR-05: Red Flags & Risk Warnings
- Mã loại: lý do + badge. Mã mới: cảnh báo.
- Warning badges cho mã scored: D/E≥3 → "Đòn bẩy", OCF âm → "Dòng tiền", Legal≥4 → "Pháp lý", Inv/TA>60% → "Tồn kho"

### 7.6 FR-06: Stock Detail
- Candlestick + Radar + breakdown 5 nhóm + entry signal + stop loss + S/R zones

### 7.7 FR-07: Risk Management

**Stop Loss:**
- Cố định -10% từ giá mua. Nếu chưa có buy_price, dùng current_price làm reference.
- stop_loss_price = buy_price × 0.90 (hoặc current_price × 0.90)
- Hiển thị ở Detail + Top MUA (expand) + PDF.

**Phân bổ vốn:**
- Chỉ phân bổ cho mã recommendation = MUA
- weight_i = score_i / sum(scores của tất cả mã MUA)
- amount_i = total_capital × weight_i
- Nhập tổng vốn thủ công mỗi lần chạy

**Confidence Penalty cho Warning Badges:**

> [v0.5A FIX] Deterministic thay vì "5-10%"

| Số lượng badges | Confidence penalty |
|---|---|
| 1 badge | -5 percentage points |
| 2 badges | -10 percentage points |
| 3+ badges | -15 percentage points |
| **Max penalty cap** | **-20 percentage points** |

Ví dụ: XGBoost predict_proba = 82% MUA, mã có 2 warning badges → confidence hiển thị = 82% - 10% = **72%**.

### 7.8 FR-08: Explainability
- Tóm tắt 3-5 dòng từ scoring features + risk flags (KHÔNG LLM generate tự do — GUARD-02). Drill-down breakdown 5 nhóm.

### 7.9 FR-09: Portfolio Lite
- **MVP:** CRUD danh mục (mã, số lượng, giá mua, ngày) + lãi/lỗ cơ bản
- **Post-MVP:** lịch sử giao dịch nâng cao + phân tích hiệu suất

### 7.10 FR-10: Run History & Backtest
- Lịch sử runs + so sánh 2 lần chạy (hiển thị mã thay đổi khuyến nghị)

**Backtest Core (MVP):**
- Tỷ lệ đúng khuyến nghị (theo definition Section 4.5)
- Sai số giá: |predicted - actual| / actual × 100%
- ROI portfolio MUA vs VN-Index cùng kỳ
- Chưa tính phí GD/slippage

**Backtest Advanced (Post-MVP):**
- Survivorship bias handling, transaction cost, slippage, rebalance rules

### 7.11 FR-11: News & Sentiment
- 5 nguồn: CafeF, VnExpress, Vietstock, Batdongsan, Thanh Niên. RSS ưu tiên, robots.txt.
- AI Sentiment + màn hình riêng, lọc theo mã/nguồn/sentiment.

**Sentiment Output Rules (GUARD-08):**

> [v0.5A NEW] Ngăn AI bịa sentiment không có nguồn

- Sentiment label: enum **POSITIVE / NEUTRAL / NEGATIVE** (chỉ 3 giá trị)
- Sentiment score: số từ **-1.0 đến +1.0**
- Sentiment reason: phải cite **article title + source + date**, hoặc ghi "unavailable"
- Nếu không có tin trong 30 ngày → sentiment = NEUTRAL, score = 0.0
- Nếu nguồn lỗi, skip nguồn đó + crawl nguồn còn lại

### 7.12 FR-12: Export & Share
- PDF: Overview + Top MUA + Red Flags + Stop Loss + Allocation + Disclaimer
- Share link qua ngrok với Basic Auth

### 7.13 FR-13: Telegram Bot
- Bật/tắt trong Settings. Gửi sau manual run (KHÔNG cần scheduler/background job).
- Nội dung: số MUA/GIỮ/BÁN + Top N (chọn 3 hoặc 5).
- Settings: bật/tắt + chọn Top 3 hay Top 5 + nhập chat_id/token.
- Lỗi Telegram không block run, ghi log.

### 7.14 FR-14: Settings
- Theme: Classic/Light/OLED + toggle Sáng/Tối cho Classic (4 trạng thái) [Phase 4]
- Ngưỡng MUA/GIỮ/BÁN tùy chỉnh
- Bật/tắt nguồn tin (5 nguồn)
- Telegram: bật/tắt + Top N + chat_id/token
- Đổi mật khẩu. Nhập tổng vốn.

### 7.15 FR-15: Authentication
- Basic Auth. Kiến trúc sẵn sàng OAuth khi ra thị trường.

---

## 8. UI/UX Requirements

### 8.1 Design System
- design.md: SSI-inspired, brand Ngô Minh Tú. Roboto. #D32F2F. Màu TTCK VN.

### 8.2 Theme: 4 trạng thái
- Classic Dark (default), Classic Light (toggle), Light, OLED

### 8.3 Ngôn ngữ
- VIE/ENG (next-intl), nút VIE|ENG góc trên phải

### 8.4 Charts: 6 loại, 2 thư viện (Lightweight Charts + Recharts)
- Candlestick, Line, Bar, Treemap, Pie/Donut, Radar

### 8.5 Grid: TanStack Table

### 8.6 9 Màn hình
- **Must (Phase 2):** Login, Dashboard, Top MUA, Red Flags, Stock Detail
- **Should (Phase 3):** Bảng giá, Tin tức, Portfolio Lite, Telegram Settings
- **Nice (Phase 4):** Full Settings (themes), ENG translation

Desktop first, mobile responsive cơ bản.

---

## 9. Non-Functional Requirements

| NFR | Requirement | Target |
|---|---|---|
| Performance | 1 manual run | < 5 phút cho 81 mã + 38 features |
| Performance | Dashboard load | < 3 giây sau khi có data |
| Reliability | Run success rate | ≥95% runs không crash |
| Reliability | vnstock fallback | Dùng cache 24h nếu API lỗi |
| Security | Auth | Basic Auth, không lưu plaintext |
| Security | Share link | ngrok + password, link tạm thời |
| Auditability | Mỗi run lưu | model_version, settings_version, feature availability, reason/risk codes |
| Maintainability | Feature changes | Cập nhật Feature Dictionary trước khi sửa code |
| Localization | VIE/ENG | next-intl, key-based, fallback VIE |

---

## 10. Technology Decisions (High-Level)

Chi tiết implementation nằm trong Technical Design Document.

| Decision | Choice | Product rationale |
|---|---|---|
| Backend | Python + FastAPI | Compatible vnstock + ML |
| Frontend | React + Next.js | SSR, routing, SEO-ready |
| Database | SQLite → PostgreSQL | Local free, upgrade easy |
| AI | XGBoost + LSTM (baseline allowed) | Score + predict, interface-first |
| Data grid | TanStack Table | 10x lighter, vibecoding safe |
| Charts | Lightweight Charts + Recharts | 2 libs, no D3 conflict |
| i18n | next-intl | VIE/ENG |
| Hosting | Local + ngrok | Free personal |

> [Tech Design Document] sẽ chứa: API (7 groups), DB (15 tables), Engine Interfaces, Test Fixtures, Rate Limiting, Deployment

---

## 11. Vibecoding Guardrails

- **GUARD-01:** Không thêm/xóa/đổi tên scoring features nếu chưa cập nhật Feature Dictionary. Scoring features và raw indicators là 2 tập riêng biệt (xem Section 4.2).
- **GUARD-02:** Không generate lý do tự do bằng LLM. Lý do từ scoring features + risk flags + entry signals.
- **GUARD-03:** Entry Logic deterministic theo priority order + decision tree (Section 6.2 + 6.3). First match wins.
- **GUARD-04:** Thiếu data → INSUFFICIENT_DATA, không đoán.
- **GUARD-05:** Không hard-code Q3/2026. Dùng target_price_3m, target_date.
- **GUARD-06:** XGBoost/LSTM là target. Baseline engine được phép với cùng interface.
- **GUARD-07:** Mỗi run save model_version, settings_version, feature availability, reason/risk codes.
- **GUARD-08:** Sentiment output phải là enum POSITIVE/NEUTRAL/NEGATIVE, score -1.0 đến +1.0, phải cite source (title + source + date) hoặc ghi "unavailable". Không generate sentiment tự do.

---

## 12. Data Sources

- **vnstock:** giá, BCTC, chỉ số. Tự tính scoring features + raw indicators từ data vnstock.
- **Crawl SBV/GSO** (fallback tin tức): lãi suất, CPI, FDI, tín dụng BĐS.
- **5 nguồn tin:** CafeF, VnExpress, Vietstock, Batdongsan, Thanh Niên. RSS ưu tiên, robots.txt.

Chi tiết endpoints, cache keys, crawl frequency, fallback behavior, schema nằm trong Technical Design Document.

---

## 13. Edge Cases & Error Handling

| Case | Handling |
|---|---|
| Mã mới <4Q | Cảnh báo, KHÔNG phân tích |
| Mã C/W/X/hủy | Loại Vòng 1 |
| vnstock lỗi | Thông báo + cache 24h |
| Nguồn tin chặn | Skip, ghi log, RSS fallback |
| Thiếu scoring feature | Impute trung lập hoặc giảm confidence, theo missing data rules trong Tech Design |
| Thiếu ≥2 raw indicators | INSUFFICIENT_DATA (GUARD-04), không output entry signal |
| Score ngoài 0-100 | Clamp + flag outlier >3σ |
| Telegram lỗi | Run hoàn thành, log lỗi |
| Chưa có buy_price cho stop loss | Dùng current_price × 0.90 làm reference |
| Không tin tức 30 ngày | Sentiment = NEUTRAL, score = 0.0 (GUARD-08) |

---

## 14. Risks, Mitigations & Legal

| Risk | Sev | Mitigation |
|---|---|---|
| Model sai/overfit | High | Walk-forward, backtest (correctness def rõ), disclaimer, stop loss |
| vnstock change | Med | Abstraction, cache 24h, delay 0.5s |
| Crawl blocked | Med | RSS, robots.txt, 5 sources |
| Survivorship bias | Med | Disclaimer, include delisted if data exists |
| Legal: investment advice | High | Disclaimer every page + PDF + link |

**Disclaimer:** *"Công cụ chỉ hỗ trợ phân tích, KHÔNG phải khuyến nghị đầu tư chính thức. Mọi quyết định là trách nhiệm của người dùng."*

---

## 15. Success Metrics

| Metric | Target | Notes |
|---|---|---|
| Tỷ lệ đúng khuyến nghị | ≥60% | Theo correctness definition (Section 4.5) |
| Sai số giá | ≤15% | \|predicted - actual\| / actual × 100% |
| Backtest ROI | > VN-Index | Benchmark cùng kỳ |
| Thời gian chạy | < 5 phút | 81 mã + 38 features |
| Explainability coverage | ≥90% mã MUA có ≥3 lý do | From scoring features + risk flags |
| Data coverage | ≥80% mã whitelist có thể scoring | Mã đủ data qua 4 vòng lọc |
| Run success rate | ≥95% runs không crash | Bao gồm fallback khi vnstock/tin lỗi |
| PO satisfaction | Tin tưởng đầu tư thực | Định tính |

---

## 16. Roadmap & Timeline

| Phase | Weeks | Scope |
|---|---|---|
| Phase 1: Core Engine | 1-4 | Whitelist, vnstock, crawlers, 38 scoring features + raw indicators, 4 vòng lọc, XGBoost/LSTM baseline, SQLite, Walk-Forward |
| Phase 2: Core UI | 4-9 | Login, Dashboard (6 charts), Top MUA, Red Flags+warnings, Stock Detail, Stop Loss, Allocation |
| Phase 3: Extended | 9-12 | Bảng giá, News+Sentiment (GUARD-08), Portfolio Lite, Run History+compare, Telegram, PDF basic |
| Phase 4: Polish | 12-14 | 3 themes+toggle, VIE/ENG, design.md, Share link, Backtest Core (correctness def), Settings đầy đủ, bug fixes |

**Tổng: ~14 tuần. Quy tắc: Phase sau không được phá code Phase trước.**

---

## 17. Related Documents

| Document | Status | Content |
|---|---|---|
| PRD v0.5A (this) | **LOCKED** | WHAT: requirements, scope, FR, UI/UX |
| SRS | Next | HOW TO VERIFY: use cases, AC, sequences, data flow |
| Technical Design | After SRS | HOW TO BUILD: API, DB, engines, tests, deployment |

> [Tech Design] sẽ chứa: 7 nhóm API, 15 bảng DB, ScoringEngine + EntryPointEngine interfaces, Test Fixtures, Rate Limiting, Deployment, v0.3.1 Appendix A nội dung

---

## Appendix A: 38 Scoring Feature Dictionary

> [v0.5A FIX] Corrected to exactly 38 features. Raw indicators listed separately.

### A.1 Nhóm 1: Cơ bản (35%) — 16 scoring features

| ID | Feature | Good direction |
|---|---|---|
| F01 | P/E | Low (<15) |
| F02 | P/B | Low (<2) |
| F03 | ROE | High (>15%) |
| F04 | ROA | High (>5%) |
| F05 | EPS | High |
| F06 | D/E | Low (<1.5) |
| F07 | Biên lợi nhuận ròng | High |
| F08 | Tăng trưởng DT YoY | High |
| F09 | Tăng trưởng LN YoY | High |
| F10 | OCF | Positive, high |
| F11 | Current Ratio | High (>1.5) |
| F12 | Advances (tiền ứng trước KH) | Growing |
| F13 | OCF/Net Income | High (>0.5) |
| F14 | Inventory/Total Assets | Low (<60%) |
| F15 | Inventory Turnover | High (>0.5) |
| F16 | Inventory Growth vs Revenue Growth | Rev > Inv |

### A.2 Nhóm 2: Kỹ thuật (20%) — 9 scoring features

| ID | Feature | Description |
|---|---|---|
| T01 | MA Trend Score | Composite: giá vs SMA20/50/200, encode xu hướng ngắn/trung/dài hạn |
| T02 | EMA Momentum Score | Composite: EMA12 vs EMA26, encode momentum tăng/giảm |
| T03 | RSI(14) | Relative Strength Index |
| T04 | MACD Histogram | MACD Line - Signal Line, encode strength of trend |
| T05 | Bollinger Position | Vị trí giá trong Bollinger Bands (0-1, 0=lower, 1=upper) |
| T06 | Average Volume 20D | Khối lượng trung bình 20 phiên |
| T07 | Price Return 1M | % thay đổi giá 1 tháng |
| T08 | Price Return 3M | % thay đổi giá 3 tháng |
| T09 | Price Return 6M | % thay đổi giá 6 tháng |

### A.3 Nhóm 3: Vĩ mô (15%) — 5 scoring features

| ID | Feature | Source |
|---|---|---|
| M01 | Lãi suất điều hành NHNN | SBV/tin tức |
| M02 | Tăng trưởng tín dụng BĐS | SBV/GSO |
| M03 | CPI | GSO |
| M04 | FDI vào BĐS | GSO/tin tức |
| M05 | VN-Index | vnstock |

### A.4 Nhóm 4: Đặc thù BĐS (22%) — 5 scoring features

| ID | Feature | Source |
|---|---|---|
| R01 | Quỹ đất (ha) | Crawl BCTN |
| R02 | Số dự án đang triển khai | Crawl BCTN/tin |
| R03 | NAV/cổ phiếu | Tính từ BCTC |
| R04 | Chiết khấu giá so NAV | Tính: (NAV-price)/NAV |
| R05 | Legal Risk Score (1-5) | AI phân tích tin tức |

### A.5 Nhóm 5: Sentiment (8%) — 3 scoring features

| ID | Feature | Source |
|---|---|---|
| S01 | Sentiment score (-1 to +1) | AI NLP từ 5 nguồn (GUARD-08) |
| S02 | Số lượng tin 30 ngày | Crawl |
| S03 | Giao dịch nội bộ (insider net buy/sell) | CafeF/vnstock |

**Tổng: 38 scoring features (F01-F16, T01-T09, M01-M05, R01-R05, S01-S03).**

### A.6 Raw Indicators (Entry Point Logic only — KHÔNG phải scoring features)

| Indicator | Dùng cho |
|---|---|
| SMA20, SMA50, SMA200 | Tính T01 (MA Trend Score) + Entry Logic |
| EMA12, EMA26 | Tính T02 (EMA Momentum Score) + Entry Logic |
| Bollinger Upper, Bollinger Lower | Tính T05 (Bollinger Position) + Entry Logic |
| MACD Signal Line | Tính T04 (MACD Histogram) + Entry Logic |
| Support/Resistance zones | Entry Logic only |

Chi tiết formula tính scoring features từ raw indicators nằm trong Technical Design Document.

---

## 18. v0.5A Change Log

| # | Change | Section |
|---|---|---|
| Fix 1 | Feature Dictionary sửa về đúng 38 (không phải 45). Phân biệt scoring features vs raw indicators. | Section 4.2 + Appendix A |
| Fix 2 | Entry Point enum thêm priority order. First match wins. | Section 6.2 |
| Fix 3 | Confidence penalty deterministic: 1 badge = -5pp, 2 = -10pp, 3+ = -15pp, cap -20pp | Section 7.7 |
| Fix 4 | Recommendation correctness definition cho backtest | Section 4.5 |
| Fix 5 | GUARD-08 mới: Sentiment output enum, score -1 to +1, phải cite source | Section 7.11 + Section 11 |
| Fix 6 | Edge case bổ sung: không tin 30 ngày → NEUTRAL, thiếu ≥2 raw indicators → INSUFFICIENT_DATA | Section 13 |
| Fix 7 | Technical feature IDs chốt theo v0.3.1 (T01-T09 composite, không phải raw) | Appendix A.2 |
| Fix 8 | BA title clarified: "BA (Business Analyst)" | Cover page |

---

*— End of PRD v0.5A — Final Locked — Ready for SRS —*
