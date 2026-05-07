// Compare two screening runs — produces the diff payload consumed by the Compare panel
// (cluster 5 prompt §4.3 + §6.3). Pure function over two ComputedRuns.

import type { Recommendation } from '@/lib/constants';
import type {
  CompareDistributionBucket,
  CompareEntry,
  CompareRecommendationChange,
  CompareResponse,
  CompareSummaryDiff,
  RunSummary,
} from '@/lib/types';

import type { ComputedRun } from './run-compute';

// Recommendation rank for upgrade/downgrade detection.
// Higher = stronger buy.
const REC_RANK: Record<Recommendation, number> = { BAN: 0, GIU: 1, MUA: 2 };

function direction(a: Recommendation, b: Recommendation): CompareRecommendationChange['direction'] {
  if (REC_RANK[b] > REC_RANK[a]) return 'upgrade';
  if (REC_RANK[b] < REC_RANK[a]) return 'downgrade';
  return 'same';
}

const SCORE_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '<30', min: 0, max: 30 },
  { label: '30-45', min: 30, max: 45 },
  { label: '45-60', min: 45, max: 60 },
  { label: '60-75', min: 60, max: 75 },
  { label: '75-90', min: 75, max: 90 },
  { label: '≥90', min: 90, max: 101 },
];

function bucketize(scores: number[]): number[] {
  const counts = SCORE_BUCKETS.map(() => 0);
  for (const s of scores) {
    for (let i = 0; i < SCORE_BUCKETS.length; i += 1) {
      const b = SCORE_BUCKETS[i];
      if (s >= b.min && s < b.max) {
        counts[i] += 1;
        break;
      }
    }
  }
  return counts;
}

export function computeCompare(args: {
  run_a: { run_id: string; run_at: string; summary: RunSummary; computed: ComputedRun };
  run_b: { run_id: string; run_at: string; summary: RunSummary; computed: ComputedRun };
}): CompareResponse {
  const { run_a, run_b } = args;
  const aResults = run_a.computed.results;
  const bResults = run_b.computed.results;

  const aByTicker = new Map(aResults.map((r) => [r.ticker, r]));
  const bByTicker = new Map(bResults.map((r) => [r.ticker, r]));

  const summary_diff: CompareSummaryDiff = {
    total_scored: { a: run_a.summary.scored_count, b: run_b.summary.scored_count },
    buy_count: { a: run_a.summary.buy_count, b: run_b.summary.buy_count },
    hold_count: { a: run_a.summary.hold_count, b: run_b.summary.hold_count },
    sell_count: { a: run_a.summary.sell_count, b: run_b.summary.sell_count },
    avg_score: { a: run_a.summary.avg_score, b: run_b.summary.avg_score },
    duration_seconds: { a: run_a.summary.duration_seconds, b: run_b.summary.duration_seconds },
  };

  const recommendation_changes: CompareRecommendationChange[] = [];
  for (const [ticker, aRow] of aByTicker) {
    const bRow = bByTicker.get(ticker);
    if (!bRow) continue;
    if (aRow.recommendation === bRow.recommendation) continue;
    recommendation_changes.push({
      ticker,
      name: aRow.name,
      rec_a: aRow.recommendation,
      rec_b: bRow.recommendation,
      score_a: aRow.ai_score,
      score_b: bRow.ai_score,
      delta: bRow.ai_score - aRow.ai_score,
      direction: direction(aRow.recommendation, bRow.recommendation),
    });
  }
  // Sort: upgrades first (largest delta), then downgrades.
  recommendation_changes.sort((x, y) => {
    if (x.direction !== y.direction) {
      const order = { upgrade: 0, downgrade: 1, same: 2 } as const;
      return order[x.direction] - order[y.direction];
    }
    return Math.abs(y.delta) - Math.abs(x.delta);
  });

  const new_entries: CompareEntry[] = [];
  for (const [ticker, bRow] of bByTicker) {
    if (aByTicker.has(ticker)) continue;
    new_entries.push({
      ticker,
      name: bRow.name,
      recommendation: bRow.recommendation,
      score: bRow.ai_score,
    });
  }
  const removed: CompareEntry[] = [];
  for (const [ticker, aRow] of aByTicker) {
    if (bByTicker.has(ticker)) continue;
    removed.push({
      ticker,
      name: aRow.name,
      recommendation: aRow.recommendation,
      score: aRow.ai_score,
    });
  }
  new_entries.sort((x, y) => y.score - x.score);
  removed.sort((x, y) => y.score - x.score);

  const aBuckets = bucketize(aResults.map((r) => r.ai_score));
  const bBuckets = bucketize(bResults.map((r) => r.ai_score));
  const score_distribution: CompareDistributionBucket[] = SCORE_BUCKETS.map((b, i) => ({
    label: b.label,
    a_count: aBuckets[i],
    b_count: bBuckets[i],
  }));

  return {
    run_a: { run_id: run_a.run_id, run_at: run_a.run_at, model_version: run_a.summary.model_version },
    run_b: { run_id: run_b.run_id, run_at: run_b.run_at, model_version: run_b.summary.model_version },
    summary_diff,
    recommendation_changes,
    new_entries,
    removed,
    score_distribution,
  };
}
