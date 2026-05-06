// GET /version payload — TAD g02 §3.

import type { VersionResponseData } from '@/lib/types';

export const versionPayload: VersionResponseData = {
  app_version: '0.1.0',
  prd_version: 'v0.5A',
  srs_version: 'v1.0',
  tad_version: 'v1.1',
  model_version: 'baseline_v1',
  db_tables: 16,
};
