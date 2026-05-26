/**
 * Phase 19 — Critical-path smoke (login → refresh → run → dashboard → portfolio
 * → backtest → share → PDF).
 *
 * Stateful serial journey on ONE shared browser context — each step depends on
 * the localStorage/token left by the previous one. Backend assumed to be in
 * demo+stub mode (see script/e2e-start-backend.sh).
 *
 * Locale is forced to EN via addInitScript so assertions can use the English
 * translation strings; the app's default user-facing locale is VI.
 */

import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const PASSWORD = process.env.E2E_PASSWORD ?? 'ChangeMe123!';
const BACKEND = process.env.E2E_BACKEND_URL ?? 'http://localhost:8000';
const UNIQUE_TICKER = process.env.E2E_PORTFOLIO_TICKER ?? 'VHM';

test.describe('Phase 19 critical-path smoke', () => {
  let context: BrowserContext;
  let page: Page;
  let runId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ locale: 'en-US' });
    await context.addInitScript(() => {
      window.localStorage.setItem('locale', 'en');
    });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  async function readToken(): Promise<string> {
    const token = await page.evaluate(() => window.localStorage.getItem('token'));
    expect(token, 'token must be present in localStorage after login').toBeTruthy();
    return token!;
  }

  async function pollRefresh(
    request: APIRequestContext,
    refreshId: string,
    token: string,
  ): Promise<{ status: string; body: unknown }> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const res = await request.get(`${BACKEND}/api/refresh/${refreshId}/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.ok(), `refresh status ${refreshId} should return 200`).toBeTruthy();
      const body = await res.json();
      const status = body?.data?.status as string | undefined;
      if (status && ['COMPLETED', 'FAILED'].includes(status)) {
        return { status, body };
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`Refresh ${refreshId} did not reach terminal status after 15s`);
  }

  test('01 — login with password lands on dashboard', async () => {
    await page.goto('/login');
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL((url) => url.pathname === '/', { timeout: 15_000 });
    await expect(page.getByText('Total scored')).toBeVisible();
  });

  test('02 — POST /api/refresh/all reaches terminal status', async ({ request }) => {
    const token = await readToken();
    const res = await request.post(`${BACKEND}/api/refresh/all`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {},
    });
    expect(res.status(), 'refresh/all should return 202').toBe(202);
    const body = await res.json();
    const refreshId = body?.data?.refresh_id as string | undefined;
    expect(refreshId, 'refresh_id must be returned').toBeTruthy();

    const { status } = await pollRefresh(request, refreshId!, token);
    // demo+stub mode: refresh completes (empty rows). FAILED also acceptable if
    // the backend rejects the empty-success path; we only require a terminal.
    expect(['COMPLETED', 'FAILED']).toContain(status);
  });

  test('03 — Run from Dashboard reaches COMPLETED', async () => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Run', exact: true }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Total capital for this run')).toBeVisible();
    await dialog.getByRole('button', { name: 'Run', exact: true }).click();

    // Wait for terminal badge text.
    await expect(
      page.getByText(/COMPLETED( \(WARNINGS\))?/).first(),
    ).toBeVisible({ timeout: 45_000 });

    // Extract Run ID from "Run: run_XXXX" header line.
    const runText = await page.getByText(/Run:\s+run_/).first().textContent();
    expect(runText).toBeTruthy();
    const match = runText!.match(/Run:\s+(run_[A-Za-z0-9_-]+)/);
    expect(match, 'Run ID should be parseable from dashboard header').toBeTruthy();
    runId = match![1];
  });

  test('04 — Dashboard KPI cards render', async () => {
    await page.goto(runId ? `/?run_id=${runId}` : '/');
    // Phase 25: dashboard disclaimer banner mentions VN-Index, so KPI label
    // needs `exact: true` to avoid strict-mode collision with the banner copy.
    for (const label of ['Total scored', 'BUY count', 'HOLD count', 'SELL count', 'Alpha vs VN-Index']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test('05 — Portfolio add holding shows the row', async ({ request }) => {
    // Idempotency: wipe any leftover holdings from a previous run so the form
    // submission consistently transitions empty → 1 row (rather than racing
    // a backend duplicate-ticker validation).
    const token = await readToken();
    const headers = { Authorization: `Bearer ${token}` };
    const listRes = await request.get(`${BACKEND}/api/portfolio`, { headers });
    if (listRes.ok()) {
      const listBody = await listRes.json();
      const items: Array<{ id: number | string }> = listBody?.data?.items ?? [];
      for (const item of items) {
        await request.delete(`${BACKEND}/api/portfolio/${item.id}`, { headers });
      }
    }

    await page.goto('/portfolio');

    // Page transitions Loading → (empty state | data table). Wait for the
    // spinner to clear before clicking so the Add button stops re-mounting.
    await expect(page.getByText('Loading portfolio…')).toBeHidden({ timeout: 10_000 });
    const addBtn = page.getByRole('button', { name: /Add (first )?holding/ }).first();
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Add a holding')).toBeVisible();
    await dialog.getByPlaceholder('VHM').fill(UNIQUE_TICKER);
    await dialog.getByPlaceholder('1000').fill('100');
    await dialog.getByPlaceholder('42.00').fill('42.5');
    // HoldingFormModal uses runtime TODAY (Phase 25) and validates buyDate <= TODAY,
    // so leave the default. (FE owns the buyDate; backend just persists.)
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();

    // Phase 28 — both toast AND table cell can be visible simultaneously after
    // submit (strict-mode violation). `.first()` ensure single locator match.
    await expect(
      page
        .getByText(`${UNIQUE_TICKER} is now in your portfolio.`)
        .or(page.getByRole('cell', { name: UNIQUE_TICKER }))
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('06 — Backtest from Run History reaches result', async () => {
    // Next.js dev server occasionally aborts navigation when Fast Refresh kicks
    // in mid-load — retry once with a lighter waitUntil if so.
    try {
      await page.goto('/run-history', { waitUntil: 'domcontentloaded' });
    } catch (e) {
      if (String(e).includes('ERR_ABORTED')) {
        await page.goto('/run-history', { waitUntil: 'commit' });
      } else {
        throw e;
      }
    }
    const headerBtn = page.getByRole('button', { name: 'Run Backtest' });
    await expect(headerBtn).toBeVisible();
    await expect(headerBtn).toBeEnabled();
    await headerBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Run a backtest')).toBeVisible();
    await dialog.getByRole('button', { name: 'Run backtest' }).click();

    await expect(page.getByText('Recommendation accuracy')).toBeVisible({ timeout: 30_000 });
  });

  test('07 — Share link modal exposes a token URL', async () => {
    await page.goto(runId ? `/?run_id=${runId}` : '/');
    await page.getByRole('button', { name: 'Share' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Create share link')).toBeVisible();
    const urlInput = dialog.locator('input[readonly]');
    await expect(urlInput).toHaveValue(/\/share\/[A-Za-z0-9-]{8,}/, { timeout: 10_000 });
  });

  test('08 — Export PDF triggers a download', async () => {
    await page.goto(runId ? `/?run_id=${runId}` : '/');
    await page.getByRole('button', { name: 'Export PDF' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('PDF preview')).toBeVisible();

    // Download button is disabled while the preview iframe loads — wait for it
    // to become enabled before clicking, otherwise the click races a re-render.
    const downloadBtn = dialog.getByRole('button', { name: 'Download', exact: true });
    await expect(downloadBtn).toBeEnabled({ timeout: 20_000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
    await downloadBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^run-.+\.pdf$/);
  });
});
