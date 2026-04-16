import { chromium } from "playwright";
import type { InputPayload } from "./schema.js";
import { buildSiteStyleProfile, capturePageSnapshot, dismissConsentOverlays } from "./pageAnalysis.js";
import { discoverInternalPages } from "./pageDiscovery.js";
import { renderMarkdownSummary } from "./markdown.js";
import { synthesizeResult } from "./synthesis.js";
import type { SiteProfile, StyleTraceResult } from "./types.js";
import { normalizeInput } from "./validation.js";

export async function analyzeWebsiteStyle(input: InputPayload): Promise<StyleTraceResult> {
  const normalized = normalizeInput(input);
  const browser = await chromium.launch({ headless: true });

  try {
    const sites: SiteProfile[] = [];
    for (const url of normalized.urls) {
      sites.push(await analyzeSite(browser, url, normalized.maxPagesPerSite, normalized.pageSelectionMode));
    }

    const result = synthesizeResult(sites, normalized.synthesisMode);
    if (normalized.outputFormat === "json+markdown") {
      result.markdownSummary = renderMarkdownSummary(result);
    }

    return result;
  } finally {
    await browser.close();
  }
}

async function analyzeSite(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  url: string,
  maxPagesPerSite: number,
  pageSelectionMode: "auto" | "homepage-only",
): Promise<SiteProfile> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  try {
    const homepage = await context.newPage();
    await loadPage(homepage, url);
    await dismissConsentOverlays(homepage);

    const candidatePages = pageSelectionMode === "homepage-only"
      ? []
      : await discoverInternalPages(homepage, maxPagesPerSite);

    const snapshots = [await capturePageSnapshot(homepage)];

    for (const candidateUrl of candidatePages) {
      const page = await context.newPage();
      try {
        await loadPage(page, candidateUrl);
        await dismissConsentOverlays(page);
        snapshots.push(await capturePageSnapshot(page));
      } catch {
        continue;
      } finally {
        await page.close();
      }
    }

    const { styleProfile, pageSignals, reproductionBasis } = buildSiteStyleProfile(snapshots);

    return {
      url,
      pagesAnalyzed: snapshots.map((snapshot) => snapshot.path || new URL(snapshot.url).pathname || "/"),
      styleProfile,
      evidence: {
        analyzedPageCount: snapshots.length,
        pageSignals,
        reproductionBasis,
      },
    };
  } finally {
    await context.close();
  }
}

async function loadPage(page: import("playwright").Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
}
