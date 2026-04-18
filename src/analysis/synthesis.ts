import type {
  DesignAspectKey,
  GuidelineRule,
  InternalStyleTraceResult,
  ReferenceSignature,
  SiteProfile,
  SynthesisMode,
} from "../core/types.js";
import { rankStrongestAspects } from "./visualGrammar.js";

const ASPECT_KEYS: DesignAspectKey[] = [
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

export function synthesizeResult(sites: SiteProfile[], synthesisMode: SynthesisMode): InternalStyleTraceResult {
  const synthesisSites = synthesisMode === "single-site-profile" ? sites.slice(0, 1) : sites;
  const sharedPatterns = collectSharedPatterns(synthesisSites);
  const referenceSignatures = synthesisSites.map(buildReferenceSignature);
  const rules = buildAspectPreservingRules(synthesisSites);

  return {
    sites,
    synthesis: {
      mode: "aspect-grammar",
      sharedPatterns,
      referenceSignatures,
      blendStrategy: {
        headline: synthesisMode === "single-site-profile"
          ? "Preserve the lead reference across all ten designGrammar aspects instead of broadening it into a category average."
          : "Blend only the aspect patterns that genuinely repeat; preserve each reference’s strongest aspect signatures explicitly.",
        directives: buildBlendDirectives(synthesisSites, sharedPatterns),
        avoid: [
          "Do not let shared category defaults override the strongest aspect signals from the references.",
          "Do not treat weakly inferred aspects like micro-interactions or breakpoints as hard truths.",
          "Do not flatten visual hierarchy, color architecture, and navigation logic into a generic premium-tech template.",
        ],
      },
    },
    guideline: {
      mode: "aspect-preserving-synthesis",
      rules,
      avoid: [
        {
          rule: "Do not smooth ten-aspect output into a single generic style sentence.",
          reason: "Each aspect should stay legible as its own design signal.",
        },
        {
          rule: "Do not over-trust low-confidence aspects.",
          reason: "Micro-interactions, forms, and breakpoints are currently inferred more weakly than hierarchy or color.",
        },
      ],
    },
  };
}

function collectSharedPatterns(sites: SiteProfile[]): Array<{ aspect: DesignAspectKey; summary: string }> {
  if (sites.length === 0) {
    return [];
  }

  return ASPECT_KEYS.flatMap((aspect) => {
    const sameConfidenceSites = sites.filter((site) => site.designGrammar[aspect].confidence !== "low");
    if (sameConfidenceSites.length < Math.max(1, Math.ceil(sites.length / 2))) {
      return [];
    }

    const summary = mostCommon(sameConfidenceSites.map((site) => site.designGrammar[aspect].summary));
    if (!summary) {
      return [];
    }

    return [{ aspect, summary }];
  }).slice(0, 6);
}

function buildReferenceSignature(site: SiteProfile): ReferenceSignature {
  const strongestAspects = rankStrongestAspects(site.designGrammar);
  const motifs = site.designGrammar.signatureMotifs.map((motif) => motif.label).slice(0, 4);
  const evidencePaths = uniqueStrings([
    ...site.designGrammar.signatureMotifs.flatMap((motif) => motif.evidencePaths ?? []),
    ...strongestAspects.flatMap((aspect) => site.designGrammar[aspect].evidencePaths ?? []),
  ]).slice(0, 4);

  return {
    siteUrl: site.url,
    summary: strongestAspects.map((aspect) => `${aspect}: ${site.designGrammar[aspect].summary}`).join(" | "),
    strongestAspects,
    motifs,
    evidencePaths,
  };
}

function buildAspectPreservingRules(sites: SiteProfile[]): GuidelineRule[] {
  const rules: GuidelineRule[] = [];
  pushRule(
    rules,
    sites.filter((site) => site.designGrammar.visualHierarchy.confidence !== "low").length,
    sites.length,
    "Preserve visual hierarchy as the primary reconstruction constraint before styling lower-level components",
  );
  pushRule(
    rules,
    sites.filter((site) => site.designGrammar.colorArchitecture.confidence !== "low").length,
    sites.length,
    "Use color architecture as a system-level constraint rather than decorative inspiration",
  );
  pushRule(
    rules,
    sites.filter((site) => site.designGrammar.navigationLogic.confidence !== "low").length,
    sites.length,
    "Keep navigation logic faithful to the references instead of defaulting to a generic nav shell",
  );
  pushRule(
    rules,
    sites.filter((site) => site.designGrammar.iconographyAndImagery.confidence !== "low").length,
    sites.length,
    "Treat imagery and iconography as composition drivers, not filler assets",
  );
  pushRule(
    rules,
    sites.filter((site) => site.designGrammar.microInteractions.confidence === "low").length,
    sites.length,
    "Be cautious when inferring micro-interactions; current evidence is weaker than the static visual aspects",
  );
  return rules;
}

function buildBlendDirectives(sites: SiteProfile[], sharedPatterns: Array<{ aspect: DesignAspectKey; summary: string }>): string[] {
  const directives = sharedPatterns.map((pattern) => `Shared ${pattern.aspect}: ${pattern.summary}`);
  for (const site of sites) {
    const strongestAspects = rankStrongestAspects(site.designGrammar);
    for (const aspect of strongestAspects) {
      directives.push(`From ${site.url}, preserve ${aspect}: ${site.designGrammar[aspect].summary}`);
    }
  }
  return uniqueStrings(directives).slice(0, 8);
}

function pushRule(rules: GuidelineRule[], evidenceCount: number, totalSites: number, rule: string): void {
  if (evidenceCount === 0) {
    return;
  }

  rules.push({
    rule,
    evidenceCount,
    confidence: classifyConfidence(evidenceCount, totalSites),
  });
}

function classifyConfidence(evidenceCount: number, totalSites: number): "high" | "medium" | "low" {
  if (evidenceCount === totalSites) {
    return "high";
  }
  if (evidenceCount >= Math.max(1, Math.ceil(totalSites / 2))) {
    return "medium";
  }
  return "low";
}

function mostCommon<T>(values: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
