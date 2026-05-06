# PROMPT — CỤM 4: Market Browse (Price Board + News & Sentiment)

> **Prototype UI/UX** trong `/Users/ngominhtu/Projects/stock-v2/prototype/` — đây là prototype để test UX, KHÔNG implement business logic thực. Mọi data từ MSW mocks.
>
> Build trên Cụm 1+2+3.

---

## 0. Context — Đọc trước khi code

1. Code đã có Cụm 1-3 trong `prototype/`
2. `docs/PRD_v0.5A_Final_Locked.md` §7.3 (Price Board), §7.11 (News + GUARD-08), §8.4
3. `docs/design.md` §3.2-3.3 (stock colors + flash colors), §6.5 (price board patterns)
4. `tad/g02-api.md` — `/stocks`, `/stocks/{ticker}/prices`, `/news`, `/news/sentiment/{ticker}`
5. `tad/c04-news-sentiment.md`
6. `srs/f05-price-board.md`
7. `srs/f10-news-sentiment.md`

---

## 1. Mục tiêu cụm

Test UX cho 2 màn hình browse data ngoài screening flow:
- **Price Board** (`/price-board`): bảng ~81 mã với màu TTCK VN, sort/filter, click → Stock Detail
- **News** (`/news`): list tin từ 5 nguồn + sentiment chip + filter theo mã/nguồn/sentiment

---

## 2. Tech additions

Không thêm thư viện mới — TanStack Table (đã có Cụm 2) đủ cho cả 2 màn hình.

---

## 3. Price Board page (`/price-board`)

### 3.1 Layout

Theo design.md §6.5 (compact data display):
- Font Roboto, size 11px (`text-2xs`)
- Row even/odd alternating bg theo theme price-table tokens
- Column header sticky, có thể resize
- Border: `--color-theme-price-table-border`

### 3.2 Columns

| Column | Source | Color rule |
|---|---|---|
| Ticker | stocks.ticker | text-tertiary, click → /stock-detail |
| Sector | stocks.sector | text-secondary |
| Reference | latest_price.reference | yellow ref color |
| Ceiling | latest_price.ceiling | purple ceil |
| Floor | latest_price.floor | blue floor |
| Open | latest_price.open | text-primary |
| High | latest_price.high | green if > ref |
| Low | latest_price.low | red if < ref |
| **Close** | latest_price.close | **Theo TTCK rule:** ceil/up/ref/down/floor color |
| Change | close - reference | matching color |
| Change % | (close-ref)/ref × 100 | matching color |
| Volume | latest_price.volume | text-primary, format K/M |
| Newly listed | stocks.newly_listed | badge "Mới" nếu true |

### 3.3 TTCK color rule (CRITICAL)

```typescript
function priceColor(price: number, ceiling: number, floor: number, reference: number): TTCKColor {
  if (price === ceiling) return 'ceil';   // tím
  if (price === floor)   return 'floor';  // xanh dương
  if (price > reference) return 'up';     // xanh lá
  if (price < reference) return 'down';   // đỏ
  return 'ref';                            // vàng
}
```

Apply qua CSS class `text-{color}` map sang `--ssi-{color}` token. Test trên cả 4 themes.

### 3.4 Features

- **Sort**: click header → sort asc/desc, indicator arrow
- **Search**: input top-right, search ticker (debounce 200ms)
- **Filter**:
  - Exchange: HOSE / HNX / UPCOM (multi-select chips)
  - Sector: dropdown
  - Newly listed only: toggle
- **Pagination**: limit=100, default đủ cho 81 mã 1 page (no pagination needed). Vẫn implement infinite scroll skeleton để test UX nếu mở rộng sau
- **Click row** → navigate `/stock-detail?ticker={ticker}` (không cần run_id — show static info)

### 3.5 Empty state

"Không có mã phù hợp" khi filter rỗng.

---

## 4. News page (`/news`)

### 4.1 Layout

2-column layout desktop:
- **Left (320px)**: filter panel (sticky)
- **Right (flex)**: news list

Mobile: filter dạng drawer trigger từ header.

### 4.2 Filter panel

- **Source**: 5 checkboxes — CafeF, VnExpress, Vietstock, Batdongsan, Thanh Niên (icon mỗi nguồn)
- **Sentiment**: 3 radio — All / Positive / Neutral / Negative (4 actually) với color chips
- **Ticker**: autocomplete input — chọn 1 mã, list tin liên quan
- **Date range**: 7d / 30d / 90d / All (radio)
- **Reset filters** button

### 4.3 News card

Mỗi tin = card horizontal:
- Source logo/badge (color theo nguồn)
- Title (text-md, bold) — click open URL trong tab mới
- Snippet (2 lines, ellipsis)
- Footer: published_at (relative time "2h trước") + sentiment chip + related tickers chips
- Border-left color theo sentiment: green / gray / red

Sentiment chip:
- POSITIVE: green với icon ↑
- NEUTRAL: gray với icon —
- NEGATIVE: red với icon ↓
- Score in tooltip: "Score: +0.65 (POSITIVE)"

### 4.4 Empty / loading states

- Empty: "Không có tin trong 30 ngày" với illustration
- Loading: skeleton 5 cards
- Source error: nếu mock 1 nguồn fail → banner trên top "Nguồn {X} tạm thời không khả dụng" (test GUARD-08 fallback UX)

### 4.5 Pagination

`limit=20`, infinite scroll. Trigger fetch next khi scroll bottom 200px.

---

## 5. Sentiment summary widget (bonus)

Khi filter có ticker chọn → hiển thị widget top trong news list:
- "Sentiment cho VHM (30 ngày)": doughnut nhỏ POSITIVE/NEUTRAL/NEGATIVE % + score trung bình
- Số lượng tin
- Source breakdown (mini bar)

Data từ `GET /api/news/sentiment/{ticker}` mock.

---

## 6. Mock API (MSW handlers thêm)

### 6.1 GET /api/stocks?limit=100&offset=0

- Return 81 mã từ stocks-fixture với latest price (sinh ngẫu nhiên reference + close gần đó, set ceiling=ref×1.07, floor=ref×0.93 cho HOSE)
- Pagination envelope theo g02 §2

### 6.2 GET /api/stocks/{ticker}/prices

Đã có trong Cụm 3.

### 6.3 GET /api/news?limit=20&offset=0&source=&sentiment=&ticker=&from=&to=

- Sinh fixture ~150 articles trong 90 ngày
- Distribute đều 5 nguồn
- Mỗi article:
  - title (templates pre-baked: "VHM công bố...", "Lãi suất giảm tác động...", etc.)
  - url (mock: `https://mock-{source}.example/article/{id}`)
  - published_at (random trong 90 ngày)
  - content_snippet (~150 chars)
  - related_tickers (0-3 tickers từ fixture)
  - sentiment_label (POSITIVE 40% / NEUTRAL 35% / NEGATIVE 25% phân bố)
  - sentiment_score (random trong khoảng phù hợp với label)
  - sentiment_reason: cite "Article '{title}' from {source}, {date}" hoặc "unavailable" (GUARD-08)
- Filter logic: support multi-source, multi-sentiment, ticker filter (article có ticker trong related_tickers)
- Date filter: published_at trong range

### 6.4 GET /api/news/sentiment/{ticker}

Compute on-the-fly từ articles 30 ngày:
- count POSITIVE/NEUTRAL/NEGATIVE
- avg score
- source breakdown
- Nếu count=0 → return `{ label: NEUTRAL, score: 0.0 }` (GUARD-08 rule)

### 6.5 Mock failure modes

URL toggle `?mock_news_failure=cafef` → simulate CafeF source error trong response (return banner-trigger flag).

---

## 7. Components mới

```
src/components/
├── price-board/
│   ├── PriceBoardTable.tsx
│   ├── PriceCell.tsx              # với TTCK color logic
│   └── PriceBoardFilters.tsx
├── news/
│   ├── NewsList.tsx
│   ├── NewsCard.tsx
│   ├── NewsFilters.tsx
│   ├── SentimentChip.tsx
│   └── SentimentSummaryWidget.tsx
└── common/
    └── SourceLogo.tsx              # 5 nguồn
```

Hooks: `useStocks`, `useNews(filters)` (with pagination), `useSentimentSummary(ticker)`.

---

## 8. i18n keys thêm

- `priceBoard.column.ticker` / `.sector` / `.reference` / `.ceiling` / `.floor` / `.open` / `.high` / `.low` / `.close` / `.change` / `.changePct` / `.volume`
- `priceBoard.filter.exchange` / `.sector` / `.newlyListed`
- `priceBoard.search.placeholder`
- `news.filter.source` / `.sentiment` / `.ticker` / `.dateRange`
- `news.source.cafef` / `.vnexpress` / `.vietstock` / `.batdongsan` / `.thanhnien`
- `news.sentiment.POSITIVE` / `.NEUTRAL` / `.NEGATIVE` / `.all`
- `news.dateRange.7d` / `.30d` / `.90d` / `.all`
- `news.empty` / `.sourceError`
- `news.summary.title` / `.score.avg` / `.count`

---

## 9. Acceptance criteria

1. Price Board hiển thị đủ 81 mã, scroll mượt, sort theo Close DESC default
2. Color TTCK: test 5 trường hợp (ceil/up/ref/down/floor) đúng theo cả 4 themes
3. Search "VHM" → 1 row; clear search → 81 rows
4. Filter exchange HOSE only → đúng số lượng theo fixture
5. Click row → navigate `/stock-detail?ticker=VHM` đúng URL
6. News: 5 source filters work, multi-select OR logic
7. Sentiment filter POSITIVE → chỉ tin xanh
8. Ticker filter "KDH" → chỉ tin có KDH trong related_tickers
9. Date range 7d → giảm số lượng cards
10. Sentiment summary widget xuất hiện chỉ khi có ticker filter, doughnut + score render đúng
11. Mock failure CafeF → banner báo source error
12. Mobile: filter drawer slide-in, news cards stack đẹp
13. Performance: 81 mã price board render < 200ms với theme switch

---

## 10. Lưu ý

- **KHÔNG** implement charts mới — Price Board là bảng thuần.
- TTCK color rule là **critical** — test kỹ tất cả 5 trường hợp + 4 themes.
- News sentiment phải tuân GUARD-08: sentiment_reason cite source HOẶC "unavailable", không generate tự do.
- Source logos có thể dùng text/initial nếu không có asset (đừng download logo thật, là prototype).
