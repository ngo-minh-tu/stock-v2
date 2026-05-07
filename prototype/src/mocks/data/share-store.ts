// Cluster 6 §4 + TAD g03 Table 15 — share_links store.
// In-memory: token (uuid v4 mock) → ShareLink. Singleton survives MSW handler reloads
// within a single tab session via globalThis (matches portfolioStore / runsStore pattern).

import type { ShareLink } from '@/lib/types';

const SHARE_BASE_URL = 'https://app.example/share';

function uuidv4(): string {
  // Browser native first; fall back to Math.random for environments without crypto.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class ShareStore {
  private byToken = new Map<string, ShareLink>();

  list(): ShareLink[] {
    // Newest first — Settings table reads this top-down.
    return [...this.byToken.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }

  get(token: string): ShareLink | null {
    return this.byToken.get(token) ?? null;
  }

  /**
   * Create a new link. Each call generates a fresh token even for the same run_id —
   * enables "regenerate" UX without revoking the old one separately.
   */
  create(run_id: string, expires_in_days: number): ShareLink {
    const token = uuidv4();
    const nowMs = Date.now();
    const link: ShareLink = {
      token,
      run_id,
      url: `${SHARE_BASE_URL}/${token}`,
      created_at: new Date(nowMs).toISOString(),
      expires_at: new Date(nowMs + expires_in_days * 86_400_000).toISOString(),
    };
    this.byToken.set(token, link);
    return link;
  }

  remove(token: string): boolean {
    return this.byToken.delete(token);
  }

  /** Returns true when the link is missing or past `expires_at`. */
  isExpired(link: ShareLink, nowMs: number = Date.now()): boolean {
    return new Date(link.expires_at).getTime() <= nowMs;
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __shareStore: ShareStore | undefined;
}

export const shareStore: ShareStore =
  globalThis.__shareStore ?? (globalThis.__shareStore = new ShareStore());
