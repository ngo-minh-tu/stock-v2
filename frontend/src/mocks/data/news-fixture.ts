// Deterministic news fixture: 150 articles distributed across 5 sources, 90-day window.
// Pre-baked titles per GUARD-08 — sentiment_reason cites article + source + date,
// with 5% "unavailable" to exercise the GUARD-08 fallback UI.

import type { NewsSourceKey, SentimentLabelKey } from '@/lib/constants';
import type { NewsArticle } from '@/lib/types';

import { STOCK_FIXTURE } from './stocks-fixture';

// Mulberry32 — same family as cluster 3's prices fixture for deterministic per-seed PRNG.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SOURCES: NewsSourceKey[] = ['CAFEF', 'VNEXPRESS', 'VIETSTOCK', 'BATDONGSAN', 'THANHNIEN'];

// 18 vi-language title templates — keyword-loaded so a future NLP classifier could pick a label.
// Each template is paired with a sentiment hint to avoid contradictory pairings; the 40/35/25
// distribution is enforced separately so the bag stays balanced.
const TITLE_TEMPLATES: { tone: 'positive' | 'neutral' | 'negative'; tpl: string }[] = [
  { tone: 'positive', tpl: '{T} công bố lợi nhuận quý tăng {n}%' },
  { tone: 'positive', tpl: '{T} mở bán dự án mới, hấp thụ vượt kỳ vọng' },
  { tone: 'positive', tpl: 'Chiến lược tái cấu trúc của {T} bắt đầu cho trái ngọt' },
  { tone: 'positive', tpl: '{T} ký hợp đồng tín dụng {n} tỷ đồng cho dự án trọng điểm' },
  { tone: 'positive', tpl: 'Cổ phiếu {T} bứt phá nhờ kết quả kinh doanh tích cực' },
  { tone: 'neutral',  tpl: '{T} tổ chức ĐHCĐ thường niên năm 2026' },
  { tone: 'neutral',  tpl: '{T} bổ nhiệm thành viên HĐQT mới' },
  { tone: 'neutral',  tpl: 'Báo cáo phân tích ngành BĐS quý mới — {T} trong tâm điểm' },
  { tone: 'neutral',  tpl: '{T} công bố tài liệu họp cổ đông' },
  { tone: 'neutral',  tpl: 'Lãi suất giảm tác động trung tính tới nhóm BĐS' },
  { tone: 'neutral',  tpl: 'Vingroup, Novaland, {T} đồng loạt tổ chức hội nghị nhà đầu tư' },
  { tone: 'negative', tpl: '{T} gặp vướng mắc pháp lý tại dự án {n}' },
  { tone: 'negative', tpl: 'Doanh thu của {T} sụt giảm {n}% so với cùng kỳ' },
  { tone: 'negative', tpl: 'Áp lực bán mạnh khiến cổ phiếu {T} mất {n}%' },
  { tone: 'negative', tpl: '{T} bị phạt do công bố thông tin chậm' },
  { tone: 'negative', tpl: 'Cảnh báo nợ xấu gia tăng tại {T}' },
  { tone: 'negative', tpl: 'Ban kiểm soát {T} lưu ý về dòng tiền âm liên tục' },
  { tone: 'negative', tpl: 'Cổ đông lớn {T} thoái vốn, cổ phiếu giảm sàn' },
];

const SNIPPET_TEMPLATES: Record<'positive' | 'neutral' | 'negative', string[]> = {
  positive: [
    'Doanh nghiệp ghi nhận biên lợi nhuận cải thiện rõ rệt nhờ kiểm soát chi phí và bán được các sản phẩm cao cấp tại các dự án trọng điểm trong quý vừa qua.',
    'Nhóm phân tích đánh giá triển vọng tích cực với việc bàn giao các dự án mới trong nửa cuối năm, hỗ trợ đà phục hồi của cổ phiếu.',
    'Ban lãnh đạo cho biết kế hoạch mở rộng quỹ đất sẽ tiếp tục là động lực tăng trưởng dài hạn cho doanh nghiệp.',
  ],
  neutral: [
    'Nội dung cuộc họp tập trung vào kế hoạch sản xuất kinh doanh năm 2026 và phương án phân phối lợi nhuận.',
    'Báo cáo cập nhật một số chỉ tiêu vận hành mà không đưa ra điều chỉnh đáng kể về dự phóng cả năm.',
    'Thị trường chờ đợi thêm thông tin cụ thể từ phía doanh nghiệp trước khi điều chỉnh khuyến nghị đầu tư.',
  ],
  negative: [
    'Áp lực dòng tiền tiếp tục là rủi ro lớn khi mức nợ vay duy trì ở vùng cao và lãi suất chưa hạ rõ rệt.',
    'Việc chậm hoàn tất pháp lý dự án có thể ảnh hưởng tới kế hoạch ghi nhận doanh thu trong các quý tới.',
    'Một số tổ chức đã hạ khuyến nghị, cảnh báo rủi ro pha loãng nếu doanh nghiệp tiếp tục huy động vốn.',
  ],
};

// 5% of articles get "unavailable" reason to exercise GUARD-08 fallback styling.
const UNAVAILABLE_RATE = 0.05;

// Anchor today to the user's currentDate for stable snapshots — see CLAUDE.md memory.
// Exported so the news/sentiment handler and the page's date-range filter use the SAME
// "now" — otherwise wall-clock drift makes 30-day windows return 0 articles when the user
// runs the app on a date != 2026-05-07.
export const FIXTURE_NOW_MS = new Date('2026-05-07T08:00:00Z').getTime();
const TODAY = FIXTURE_NOW_MS;
const DAY_MS = 24 * 60 * 60 * 1000;

function pickSentimentByDistribution(rng: () => number): SentimentLabelKey {
  // Target: POSITIVE 40% / NEUTRAL 35% / NEGATIVE 25% per cluster prompt §6.3.
  const r = rng();
  if (r < 0.4) return 'POSITIVE';
  if (r < 0.75) return 'NEUTRAL';
  return 'NEGATIVE';
}

function scoreFromLabel(label: SentimentLabelKey, rng: () => number): number {
  // Per GUARD-08: -1.0 to +1.0, 2 decimals. Tighten ranges so labels stay coherent.
  const raw =
    label === 'POSITIVE'
      ? 0.25 + rng() * 0.65       // 0.25..0.90
      : label === 'NEGATIVE'
        ? -(0.25 + rng() * 0.65)  // -0.90..-0.25
        : -0.20 + rng() * 0.40;   // -0.20..0.20
  return Number(raw.toFixed(2));
}

function toneForLabel(label: SentimentLabelKey): 'positive' | 'neutral' | 'negative' {
  if (label === 'POSITIVE') return 'positive';
  if (label === 'NEGATIVE') return 'negative';
  return 'neutral';
}

function pickTemplate(
  tone: 'positive' | 'neutral' | 'negative',
  rng: () => number,
): { tpl: string } {
  const pool = TITLE_TEMPLATES.filter((t) => t.tone === tone);
  return pool[Math.floor(rng() * pool.length)];
}

function pickRelatedTickers(rng: () => number): string[] {
  // 60% chance of 1-3 tickers, 40% generic news (0 tickers).
  if (rng() > 0.6) return [];
  const n = 1 + Math.floor(rng() * 3); // 1..3
  const picks = new Set<string>();
  while (picks.size < n) {
    picks.add(STOCK_FIXTURE[Math.floor(rng() * STOCK_FIXTURE.length)].ticker);
  }
  return [...picks];
}

function formatDateForCitation(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy = d.getUTCFullYear();
  return `${dd}/${mm}/${yy}`;
}

function sourceSlug(source: NewsSourceKey): string {
  return source.toLowerCase();
}

function articleId(idx: number): string {
  return `art_${String(idx + 1).padStart(4, '0')}`;
}

// ---- Build the corpus once at module load — deterministic across reloads. ----
function buildCorpus(): NewsArticle[] {
  const rng = mulberry32(0x4e455753); // 'NEWS'
  const out: NewsArticle[] = [];
  for (let i = 0; i < 150; i += 1) {
    const source = SOURCES[i % SOURCES.length]; // even distribution across 5 sources
    const label = pickSentimentByDistribution(rng);
    const tone = toneForLabel(label);
    const score = scoreFromLabel(label, rng);
    const tpl = pickTemplate(tone, rng);
    const tickers = pickRelatedTickers(rng);
    const titleTicker = tickers[0] ?? STOCK_FIXTURE[Math.floor(rng() * STOCK_FIXTURE.length)].ticker;
    const n = 5 + Math.floor(rng() * 30);
    const title = tpl.tpl.replace('{T}', titleTicker).replace('{n}', String(n));
    const snippetPool = SNIPPET_TEMPLATES[tone];
    const snippet = snippetPool[Math.floor(rng() * snippetPool.length)];
    // Spread published_at across the last 90 days; weight slightly toward recent (rng^1.4).
    const recencyBias = Math.pow(rng(), 1.4);
    const ageDays = Math.floor(recencyBias * 90);
    const ts = TODAY - ageDays * DAY_MS - Math.floor(rng() * DAY_MS);
    const dt = new Date(ts);
    const id = articleId(i);
    const url = `https://mock-${sourceSlug(source)}.example/article/${id}`;
    const isUnavailable = rng() < UNAVAILABLE_RATE;
    const reason = isUnavailable
      ? 'unavailable'
      : `Article '${title}' from ${source}, ${formatDateForCitation(dt)}`;
    out.push({
      article_id: id,
      source,
      title,
      url,
      published_at: dt.toISOString(),
      related_tickers: tickers,
      content_snippet: snippet,
      sentiment_label: label,
      sentiment_score: score,
      sentiment_reason: reason,
    });
  }
  // Sort newest-first so default list order matches user expectation.
  out.sort((a, b) => (a.published_at < b.published_at ? 1 : -1));
  return out;
}

export const NEWS_CORPUS: NewsArticle[] = buildCorpus();

// Sentinel for the corpus size (cluster prompt §6.3 says ~150).
if (NEWS_CORPUS.length !== 150) {
  // eslint-disable-next-line no-console
  console.warn(`[news-fixture] expected 150 articles, got ${NEWS_CORPUS.length}`);
}

export interface NewsFilter {
  source?: NewsSourceKey[];           // OR within sources; empty = all
  sentiment?: SentimentLabelKey[];    // OR within sentiments; empty = all
  ticker?: string;                    // single ticker filter (related_tickers contains)
  fromIso?: string;                   // inclusive lower bound (published_at >=)
  toIso?: string;                     // inclusive upper bound (published_at <=)
}

export function filterArticles(filter: NewsFilter): NewsArticle[] {
  return NEWS_CORPUS.filter((a) => {
    if (filter.source?.length && !filter.source.includes(a.source)) return false;
    if (filter.sentiment?.length && !filter.sentiment.includes(a.sentiment_label)) return false;
    if (filter.ticker && !a.related_tickers.includes(filter.ticker.toUpperCase())) return false;
    if (filter.fromIso && a.published_at < filter.fromIso) return false;
    if (filter.toIso && a.published_at > filter.toIso) return false;
    return true;
  });
}
