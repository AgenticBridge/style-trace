import type { GuidelineRule, SiteProfile, StyleTraceResult, SynthesisMode } from "./types.js";

export function synthesizeResult(sites: SiteProfile[], synthesisMode: SynthesisMode): StyleTraceResult {
  const synthesisSites = synthesisMode === "single-site-profile" ? sites.slice(0, 1) : sites;
  const visualTone = commonStrings(
    synthesisSites.map((site) => prioritizeTones(site.styleProfile.tone)),
    synthesisMode,
  ).slice(0, 3);
  const layoutPatterns = commonStrings(synthesisSites.map((site) => site.styleProfile.layout.structure), synthesisMode);
  const componentPatterns = commonStrings(
    synthesisSites.map((site) => [
      site.styleProfile.components.nav,
      site.styleProfile.components.buttons,
      site.styleProfile.components.ctaPresence,
      site.styleProfile.components.cards,
      site.styleProfile.components.pricingBlocks,
      site.styleProfile.components.proof,
      summarizeReproductionPattern(site),
    ].filter((value) => isUsefulSharedPattern(value))),
    synthesisMode,
  ).slice(0, 5);

  const rules: GuidelineRule[] = [];
  pushRule(
    rules,
    synthesisSites.filter((site) => site.styleProfile.colors.accentCount <= 1).length,
    synthesisSites.length,
    "Use one accent color only",
  );
  pushRule(
    rules,
    synthesisSites.filter((site) => site.styleProfile.layout.structure.includes("proof")).length,
    synthesisSites.length,
    "Place social proof before dense product detail when evidence supports it",
  );
  pushRule(
    rules,
    synthesisSites.filter((site) => site.styleProfile.components.ctaPresence.includes("primary CTA")).length,
    synthesisSites.length,
    "Keep a clear primary CTA on high-visibility sections",
  );
  pushRule(
    rules,
    synthesisSites.filter((site) => site.styleProfile.layout.density !== "dense").length,
    synthesisSites.length,
    "Prefer readable spacing over tightly packed sections",
  );
  pushRule(
    rules,
    synthesisSites.filter((site) => site.styleProfile.reproduction.hero.proofNearTop).length,
    synthesisSites.length,
    "Keep trust signals near the hero when the references surface proof early",
  );
  pushRule(
    rules,
    synthesisSites.filter((site) => site.styleProfile.reproduction.buttons.radius !== "sharp").length,
    synthesisSites.length,
    "Use softened button corners instead of sharp-edged controls",
  );
  pushRule(
    rules,
    synthesisSites.filter((site) => site.styleProfile.reproduction.commerce.pricingPresence !== "none").length,
    synthesisSites.length,
    "Preserve a clear commerce path with dedicated pricing or product-detail destinations",
  );

  return {
    sites,
    observedCommonalities: {
      visualTone,
      layoutPatterns,
      componentPatterns,
    },
    guideline: {
      mode: "unopinionated-synthesis",
      rules,
      avoid: [
        {
          rule: "Do not introduce unsupported visual treatments.",
          reason: "StyleTrace only preserves repeated patterns with direct evidence.",
        },
      ],
    },
  };
}

function summarizeReproductionPattern(site: SiteProfile): string {
  const { header, hero, buttons, commerce } = site.styleProfile.reproduction;
  return [
    `${header.navDensity} nav`,
    `${hero.headingScale} ${hero.mediaStyle} hero`,
    `${buttons.radius} ${buttons.emphasis} buttons`,
    commerce.pricingPresence === "none" ? "no dedicated pricing path" : `${commerce.pricingPresence} commerce path`,
    site.styleProfile.components.cards,
    site.styleProfile.components.proof,
  ].join(", ");
}

function prioritizeTones(tones: string[]): string[] {
  const priority = ["premium", "minimal", "enterprise-like", "technical", "trust-focused", "editorial", "playful"];
  const ordered = [...tones].sort((left, right) => priority.indexOf(left) - priority.indexOf(right));
  return ordered.slice(0, 3);
}

function isUsefulSharedPattern(value: string): boolean {
  const normalized = value.toLowerCase();
  return !normalized.startsWith("no ")
    && !normalized.includes("lightweight trust copy")
    && !normalized.includes("minimal card usage");
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

function commonStrings(collections: string[][], synthesisMode: SynthesisMode): string[] {
  const counts = new Map<string, number>();
  for (const values of collections) {
    for (const value of new Set(values)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  const minimumCount = synthesisMode === "single-site-profile"
    ? 1
    : collections.length === 1
      ? 1
      : Math.max(2, Math.ceil(collections.length / 2));
  return [...counts.entries()]
    .filter(([, count]) => count >= minimumCount)
    .sort((left, right) => right[1] - left[1])
    .map(([value]) => value);
}
