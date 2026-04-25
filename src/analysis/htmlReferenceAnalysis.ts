import type { Browser, Page } from "playwright";
import { buildSiteAnalysisResult, capturePageSnapshot } from "./pageAnalysis.js";
import { captureVisualEvidence } from "./screenshotCapture.js";
import type { SiteProfile } from "../core/types.js";

export async function analyzeHtmlReference(browser: Browser, html: string, runId: string): Promise<SiteProfile> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    javaScriptEnabled: false,
  });

  try {
    const page = await context.newPage();
    await loadHtmlReference(page, html);
    const snapshots = [await capturePageSnapshot(page)];
    const { pageEvidence, capturedPages, signals, designGrammar } = buildSiteAnalysisResult(snapshots);
    const capturedPagesWithVisuals = await Promise.all(capturedPages.map(async (capturedPage, index) => ({
      ...capturedPage,
      visualCaptures: await captureVisualEvidence({
        page,
        snapshot: snapshots[index]!,
        capturedPage,
        siteUrl: "html-reference",
        runId,
      }),
    })));

    return {
      url: "inline://html-reference",
      sourceType: "html",
      pagesAnalyzed: snapshots.map((snapshot) => snapshot.path || "/html-reference"),
      pageEvidence,
      capturedPages: capturedPagesWithVisuals,
      derivedSignals: signals,
      designGrammar,
    };
  } finally {
    await context.close();
  }
}

async function loadHtmlReference(page: Page, html: string): Promise<void> {
  const sanitized = sanitizeHtmlSnippet(html);
  await page.setContent(sanitized, { waitUntil: "domcontentloaded" });
}

function sanitizeHtmlSnippet(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
}
