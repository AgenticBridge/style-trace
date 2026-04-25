import type { Page } from "playwright";

type ReadinessPage = Pick<Page, "goto" | "waitForLoadState" | "waitForTimeout" | "evaluate">;

type SettleOptions = {
  settleDelayMs?: number;
  scrollPauseMs?: number;
  topPauseMs?: number;
  dismissOverlays?: (page: Page) => Promise<void>;
};

const DEFAULT_SETTLE_DELAY_MS = 5_000;
const DEFAULT_SCROLL_PAUSE_MS = 250;
const DEFAULT_TOP_PAUSE_MS = 400;

export async function loadAndSettlePage(page: Page, url: string, options: SettleOptions = {}): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await settleLoadedPage(page, options);
}

export async function settleLoadedPage(page: Page, options: SettleOptions = {}): Promise<void> {
  await settlePageInternals(page, options);
}

async function settlePageInternals(page: ReadinessPage, options: SettleOptions): Promise<void> {
  const settleDelayMs = options.settleDelayMs ?? DEFAULT_SETTLE_DELAY_MS;
  const scrollPauseMs = options.scrollPauseMs ?? DEFAULT_SCROLL_PAUSE_MS;
  const topPauseMs = options.topPauseMs ?? DEFAULT_TOP_PAUSE_MS;

  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);

  if (settleDelayMs > 0) {
    await page.waitForTimeout(settleDelayMs);
  }

  if (options.dismissOverlays) {
    await options.dismissOverlays(page as Page);
    await page.waitForTimeout(Math.min(500, Math.max(150, scrollPauseMs)));
  }

  await warmScroll(page, scrollPauseMs);

  if (topPauseMs > 0) {
    await page.waitForTimeout(topPauseMs);
  }
}

async function warmScroll(page: ReadinessPage, scrollPauseMs: number): Promise<void> {
  const metrics = await page.evaluate(() => ({
    height: Math.max(
      document.body?.scrollHeight ?? 0,
      document.documentElement?.scrollHeight ?? 0,
      document.body?.offsetHeight ?? 0,
      document.documentElement?.offsetHeight ?? 0,
    ),
    viewport: window.innerHeight,
  }));

  const scrollHeight = Math.max(0, metrics.height);
  const viewportHeight = Math.max(1, metrics.viewport);
  const step = Math.max(600, Math.floor(viewportHeight * 0.9));

  for (let y = 0; y < scrollHeight; y += step) {
    await page.evaluate((scrollY) => {
      window.scrollTo(0, scrollY);
    }, y);
    await page.waitForTimeout(scrollPauseMs);
  }

  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
}
