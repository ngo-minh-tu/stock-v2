// Static meta for the 4 warning badges (PRD §7.5 + SRS f07).
// Per-badge label is bilingual and tooltip explains the trigger threshold.

import type { WarningBadge } from '@/lib/constants';

export interface WarningBadgeMeta {
  code: WarningBadge;
  vi: string;
  en: string;
  trigger_vi: string;
  trigger_en: string;
}

export const WARNING_BADGE_META: Record<WarningBadge, WarningBadgeMeta> = {
  HIGH_DEBT: {
    code: 'HIGH_DEBT',
    vi: 'Đòn bẩy cao',
    en: 'High debt',
    trigger_vi: 'D/E ≥ 3 — đòn bẩy tài chính cao bất thường',
    trigger_en: 'D/E ≥ 3 — abnormally high financial leverage',
  },
  NEGATIVE_OCF: {
    code: 'NEGATIVE_OCF',
    vi: 'Dòng tiền âm',
    en: 'Negative OCF',
    trigger_vi: 'OCF < 0 — dòng tiền HĐKD âm',
    trigger_en: 'OCF < 0 — operating cash flow is negative',
  },
  LEGAL_RISK: {
    code: 'LEGAL_RISK',
    vi: 'Rủi ro pháp lý',
    en: 'Legal risk',
    trigger_vi: 'Legal Risk Score ≥ 4 — có vướng mắc pháp lý đáng chú ý',
    trigger_en: 'Legal Risk Score ≥ 4 — material legal issues flagged',
  },
  HIGH_INVENTORY: {
    code: 'HIGH_INVENTORY',
    vi: 'Tồn kho cao',
    en: 'High inventory',
    trigger_vi: 'Inventory / Total Assets > 60% — tồn kho lớn so với tổng tài sản',
    trigger_en: 'Inventory / Total Assets > 60% — inventory dominates assets',
  },
};
