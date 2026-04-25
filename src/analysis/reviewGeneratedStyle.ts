import { chromium } from "playwright";
import { analyzeHtmlReference } from "./htmlReferenceAnalysis.js";
import { analyzeImageReference } from "./imageReferenceAnalysis.js";
import type { ReviewGeneratedStyleInput, ReviewGeneratedStyleResult, SiteProfile, StyleTraceResult } from "../core/types.js";

interface StyleReviewReference {
  visualVocabulary: StyleTraceResult["visualVocabulary"];
  reviewContract: StyleTraceResult["reviewContract"];
}

export async function reviewGeneratedStyle(input: ReviewGeneratedStyleInput): Promise<ReviewGeneratedStyleResult> {
  const browser = await chromium.launch({ headless: true });
  const runId = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");

  try {
    const site = input.generatedHtml
      ? await analyzeHtmlReference(browser, input.generatedHtml, runId)
      : await analyzeImageReference(browser, input.generatedImageUrl!, runId, "screenshot");

    return compareArtifactAgainstStyle(input.styleResult, site, {
      width: input.viewportWidth ?? site.capturedPages[0]?.viewport.width ?? 1440,
      height: input.viewportHeight ?? site.capturedPages[0]?.viewport.height ?? 900,
      artifactType: input.generatedHtml ? "html" : "image",
    });
  } finally {
    await browser.close();
  }
}

export function compareArtifactAgainstStyle(
  styleResult: StyleReviewReference,
  artifactSite: SiteProfile,
  input: {
    width: number;
    height: number;
    artifactType: "html" | "image";
  },
): ReviewGeneratedStyleResult {
  const matchedInvariants: ReviewGeneratedStyleResult["matchedInvariants"] = [];
  const violatedConstraints: ReviewGeneratedStyleResult["violatedConstraints"] = [];
  const driftNotes: string[] = [];

  for (const invariant of styleResult.reviewContract.mustMatch) {
    if (matchesInvariant(invariant.id, styleResult, artifactSite)) {
      matchedInvariants.push({
        id: invariant.id,
        rule: invariant.rule,
        confidence: invariant.confidence,
      });
      continue;
    }

    violatedConstraints.push({
      id: invariant.id,
      rule: invariant.rule,
      severity: invariant.confidence === "high" ? "high" : "medium",
      reason: explainInvariantMiss(invariant.id, styleResult, artifactSite),
    });
  }

  for (const risk of styleResult.reviewContract.mustAvoid) {
    if (!triggersRisk(risk.id, styleResult, artifactSite)) {
      continue;
    }

    violatedConstraints.push({
      id: risk.id,
      rule: risk.risk,
      severity: risk.severity,
      reason: risk.reason,
    });
  }

  if (styleResult.visualVocabulary.layoutSystem.moduleRhythm !== artifactSite.capturedPages[0]?.visualSignals.visualRhythm) {
    driftNotes.push(`Module rhythm drifted from ${styleResult.visualVocabulary.layoutSystem.moduleRhythm} to ${artifactSite.capturedPages[0]?.visualSignals.visualRhythm ?? "unknown"}.`);
  }
  if (styleResult.visualVocabulary.imagerySystem.heroMediaStyle !== artifactSite.derivedSignals.reproduction.hero.mediaStyle) {
    driftNotes.push(`Hero media style drifted from ${styleResult.visualVocabulary.imagerySystem.heroMediaStyle} to ${artifactSite.derivedSignals.reproduction.hero.mediaStyle}.`);
  }
  if (styleResult.visualVocabulary.componentSystem.heroCtaPattern !== artifactSite.derivedSignals.reproduction.hero.ctaPattern) {
    driftNotes.push(`Hero CTA pattern drifted from ${styleResult.visualVocabulary.componentSystem.heroCtaPattern} to ${artifactSite.derivedSignals.reproduction.hero.ctaPattern}.`);
  }
  if (styleResult.visualVocabulary.colorSystem.paletteRestraint !== artifactSite.derivedSignals.colors.paletteRestraint) {
    driftNotes.push(`Palette restraint drifted from ${styleResult.visualVocabulary.colorSystem.paletteRestraint} to ${artifactSite.derivedSignals.colors.paletteRestraint}.`);
  }

  const confidence = classifyConfidence(matchedInvariants.length, matchedInvariants.length + violatedConstraints.length);

  return {
    mode: "style-review-v1",
    artifactType: input.artifactType,
    viewport: {
      width: input.width,
      height: input.height,
    },
    matchedInvariants,
    violatedConstraints: uniqueViolations(violatedConstraints),
    driftNotes: uniqueStrings(driftNotes).slice(0, 6),
    confidence,
  };
}

function matchesInvariant(id: string, styleResult: StyleReviewReference, artifactSite: SiteProfile): boolean {
  switch (id) {
    case "visual-hierarchy":
      return artifactSite.capturedPages.some((page) => page.visualSignals.heroDominance >= 0.25)
        && artifactSite.designGrammar.visualHierarchy.confidence !== "low";
    case "color-architecture":
      return artifactSite.derivedSignals.colors.paletteRestraint === styleResult.visualVocabulary.colorSystem.paletteRestraint
        && artifactSite.derivedSignals.colors.backgroundMode === styleResult.visualVocabulary.colorSystem.backgroundMode;
    case "navigation-logic":
      return artifactSite.derivedSignals.reproduction.header.navDensity === styleResult.visualVocabulary.componentSystem.navDensity
        && artifactSite.derivedSignals.reproduction.header.ctaPattern === styleResult.visualVocabulary.componentSystem.headerCtaPattern;
    case "module-rhythm":
      return artifactSite.capturedPages[0]?.visualSignals.visualRhythm === styleResult.visualVocabulary.layoutSystem.moduleRhythm
        && artifactSite.derivedSignals.layout.density === styleResult.visualVocabulary.layoutSystem.density;
    case "imagery-treatment":
      return artifactSite.derivedSignals.reproduction.hero.mediaStyle === styleResult.visualVocabulary.imagerySystem.heroMediaStyle;
    case "component-treatment":
      return artifactSite.derivedSignals.reproduction.buttons.radius === styleResult.visualVocabulary.componentSystem.buttonRadius;
    default:
      return false;
  }
}

function explainInvariantMiss(id: string, styleResult: StyleReviewReference, artifactSite: SiteProfile): string {
  switch (id) {
    case "visual-hierarchy":
      return `Generated artifact did not preserve comparable first-screen dominance or hierarchy confidence.`;
    case "color-architecture":
      return `Generated artifact resolved to ${artifactSite.derivedSignals.colors.paletteRestraint} / ${artifactSite.derivedSignals.colors.backgroundMode} instead of ${styleResult.visualVocabulary.colorSystem.paletteRestraint} / ${styleResult.visualVocabulary.colorSystem.backgroundMode}.`;
    case "navigation-logic":
      return `Generated navigation resolved to ${artifactSite.derivedSignals.reproduction.header.navDensity} with ${artifactSite.derivedSignals.reproduction.header.ctaPattern} CTA behavior.`;
    case "module-rhythm":
      return `Generated module rhythm resolved to ${artifactSite.capturedPages[0]?.visualSignals.visualRhythm ?? "unknown"} with ${artifactSite.derivedSignals.layout.density} density.`;
    case "imagery-treatment":
      return `Generated hero media style resolved to ${artifactSite.derivedSignals.reproduction.hero.mediaStyle}.`;
    case "component-treatment":
      return `Generated button treatment resolved to ${artifactSite.derivedSignals.reproduction.buttons.radius} / ${artifactSite.derivedSignals.reproduction.buttons.emphasis}.`;
    default:
      return "Generated artifact drifted away from the reference invariant.";
  }
}

function triggersRisk(id: string, styleResult: StyleReviewReference, artifactSite: SiteProfile): boolean {
  switch (id) {
    case "generic-template-drift":
      return artifactSite.capturedPages[0]?.visualSignals.visualRhythm === "modular"
        && styleResult.visualVocabulary.layoutSystem.moduleRhythm !== "modular";
    case "unsupported-motion":
      return styleResult.visualVocabulary.motionSystem.confidence === "low"
        && artifactSite.derivedSignals.motion.motionLevel === "active";
    case "unsupported-breakpoints":
      return artifactSite.designGrammar.responsiveBreakpoints.confidence === "high"
        && styleResult.reviewContract.uncertainAreas.some((area) => /breakpoint/i.test(area));
    case "over-cardification":
      return artifactSite.capturedPages.some((page) => page.modules.filter((module) => module.cardDensity === "heavy").length >= 2)
        && styleResult.visualVocabulary.componentSystem.cardDensity !== "heavy";
    case "decorative-gradient-drift":
      return artifactSite.derivedSignals.colors.paletteRestraint === "varied"
        && styleResult.visualVocabulary.colorSystem.paletteRestraint === "restrained";
    case "target-mismatch":
      return false;
    default:
      return false;
  }
}

function classifyConfidence(matched: number, total: number): "high" | "medium" | "low" {
  if (total <= 0) {
    return "low";
  }
  if (matched === total) {
    return "high";
  }
  if (matched >= Math.max(1, Math.ceil(total / 2))) {
    return "medium";
  }
  return "low";
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function uniqueViolations(
  values: ReviewGeneratedStyleResult["violatedConstraints"],
): ReviewGeneratedStyleResult["violatedConstraints"] {
  const byId = new Map<string, ReviewGeneratedStyleResult["violatedConstraints"][number]>();
  for (const value of values) {
    byId.set(value.id, value);
  }
  return [...byId.values()];
}
