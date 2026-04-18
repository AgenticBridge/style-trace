import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { InputPayload } from "../core/schema.js";
import { buildSiteAnalysisResult, capturePageSnapshot, dismissConsentOverlays } from "./pageAnalysis.js";
import { captureVisualEvidence } from "./screenshotCapture.js";
import { synthesizeResult } from "./synthesis.js";
import type { DesignAspect, DesignAspectKey, InternalStyleTraceResult, PublicSiteProfile, SiteProfile, SiteDesignGrammar, StyleTraceResult } from "../core/types.js";
import { normalizeInput } from "../core/validation.js";

export async function analyzeWebsiteStyle(input: InputPayload): Promise<StyleTraceResult> {
  const normalized = normalizeInput(input);
  const browser = await chromium.launch({ headless: true });
  const runId = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");

  try {
    const sites: SiteProfile[] = [];
    for (const url of normalized.urls) {
      sites.push(await analyzePage(browser, url, runId));
    }

    const fullResult = synthesizeResult(sites, normalized.synthesisMode);
    const evidenceArtifactPath = normalized.evidenceMode === "file"
      ? await writeEvidenceArtifact(fullResult, runId)
      : undefined;

    return toPublicResult(
      fullResult,
      evidenceArtifactPath
        ? { includeInlineEvidence: normalized.evidenceMode === "inline", evidenceArtifactPath }
        : { includeInlineEvidence: normalized.evidenceMode === "inline" },
    );
  } finally {
    await browser.close();
  }
}

async function analyzePage(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  url: string,
  runId: string,
): Promise<SiteProfile> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  try {
    const page = await context.newPage();
    await loadPage(page, url);
    await dismissConsentOverlays(page);

    const snapshots = [await capturePageSnapshot(page)];

    const { pageEvidence, capturedPages, designGrammar } = buildSiteAnalysisResult(snapshots);
    const capturedPagesWithVisuals = await Promise.all(capturedPages.map(async (capturedPage, index) => ({
      ...capturedPage,
      visualCaptures: await captureVisualEvidence({
        page,
        snapshot: snapshots[index]!,
        capturedPage,
        siteUrl: url,
        runId,
      }),
    })));

    return {
      url,
      pagesAnalyzed: snapshots.map((snapshot) => snapshot.path || new URL(snapshot.url).pathname || "/"),
      pageEvidence,
      capturedPages: capturedPagesWithVisuals,
      designGrammar,
    };
  } finally {
    await context.close();
  }
}

async function loadPage(page: import("playwright").Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
}

async function writeEvidenceArtifact(result: InternalStyleTraceResult, runId: string): Promise<string> {
  const outputDir = path.join(process.cwd(), ".tmp", "style-trace-evidence");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${runId}.json`);
  const artifact = {
    mode: "evidence-v1",
    createdAt: runId,
    sites: result.sites.map((site) => ({
      url: site.url,
      pageEvidence: site.pageEvidence ?? [],
      visualCaptures: site.capturedPages.flatMap((page) => (page.visualCaptures ?? []).map((capture) => ({
        pagePath: page.path,
        ...capture,
      }))),
      aspectEvidence: Object.fromEntries(designAspectKeys().map((aspect) => [aspect, site.designGrammar[aspect].evidencePaths ?? []])),
      motifEvidence: site.designGrammar.signatureMotifs.map((motif) => ({
        label: motif.label,
        evidencePaths: motif.evidencePaths ?? [],
      })),
    })),
    synthesisEvidence: result.synthesis.referenceSignatures.map((signature) => ({
      siteUrl: signature.siteUrl,
      evidencePaths: signature.evidencePaths ?? [],
    })),
  };
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  return outputPath;
}

function toPublicResult(
  result: InternalStyleTraceResult,
  options: {
    includeInlineEvidence: boolean;
    evidenceArtifactPath?: string;
  },
): StyleTraceResult {
  return {
    ...result,
    ...(options.evidenceArtifactPath ? { evidenceArtifactPath: options.evidenceArtifactPath } : {}),
    sites: result.sites.map((site) => toPublicSiteProfile(site, options.includeInlineEvidence)),
    synthesis: {
      ...result.synthesis,
      referenceSignatures: result.synthesis.referenceSignatures.map((signature) => ({
        siteUrl: signature.siteUrl,
        summary: signature.summary,
        strongestAspects: signature.strongestAspects,
        motifs: signature.motifs,
        ...(options.includeInlineEvidence ? { evidencePaths: signature.evidencePaths } : {}),
      })),
    },
  };
}

function toPublicSiteProfile(site: SiteProfile, includeInlineEvidence: boolean): PublicSiteProfile {
  return {
    url: site.url,
    pagesAnalyzed: site.pagesAnalyzed,
    ...(includeInlineEvidence ? { pageEvidence: site.pageEvidence } : {}),
    capturedPages: site.capturedPages.map((page) => ({
      path: page.path,
      intent: page.intent,
      heroCtaPattern: page.heroCtaPattern,
      viewport: page.viewport,
      moduleSequence: page.moduleSequence,
      modules: page.modules,
      visualSignals: page.visualSignals,
      ...(includeInlineEvidence ? { visualCaptures: page.visualCaptures } : {}),
    })),
    designGrammar: includeInlineEvidence ? site.designGrammar : stripDesignGrammarEvidence(site.designGrammar),
  };
}

function designAspectKeys(): DesignAspectKey[] {
  return [
    "visualHierarchy",
    "typographyScale",
    "colorArchitecture",
    "gridAndSpacing",
    "iconographyAndImagery",
    "componentStates",
    "navigationLogic",
    "microInteractions",
    "formAndInputDesign",
    "responsiveBreakpoints",
  ];
}

function omitEvidencePaths<T extends { evidencePaths?: string[] }>(aspect: T): Omit<T, "evidencePaths"> {
  const { evidencePaths: _evidencePaths, ...rest } = aspect;
  return rest;
}

function stripDesignGrammarEvidence(designGrammar: SiteDesignGrammar): SiteDesignGrammar {
  return {
    model: designGrammar.model,
    visualHierarchy: omitEvidencePaths(designGrammar.visualHierarchy) as DesignAspect,
    typographyScale: omitEvidencePaths(designGrammar.typographyScale) as DesignAspect,
    colorArchitecture: omitEvidencePaths(designGrammar.colorArchitecture) as DesignAspect,
    gridAndSpacing: omitEvidencePaths(designGrammar.gridAndSpacing) as DesignAspect,
    iconographyAndImagery: omitEvidencePaths(designGrammar.iconographyAndImagery) as DesignAspect,
    componentStates: omitEvidencePaths(designGrammar.componentStates) as DesignAspect,
    navigationLogic: omitEvidencePaths(designGrammar.navigationLogic) as DesignAspect,
    microInteractions: omitEvidencePaths(designGrammar.microInteractions) as DesignAspect,
    formAndInputDesign: omitEvidencePaths(designGrammar.formAndInputDesign) as DesignAspect,
    responsiveBreakpoints: omitEvidencePaths(designGrammar.responsiveBreakpoints) as DesignAspect,
    signatureMotifs: designGrammar.signatureMotifs.map((motif) => ({
      label: motif.label,
      rationale: motif.rationale,
      strength: motif.strength,
    })),
    reconstructionDirectives: designGrammar.reconstructionDirectives,
  };
}
