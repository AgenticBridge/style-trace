import type {
  BlendMode,
  CompositionBlueprintStep,
  Confidence,
  DesignAspectKey,
  GuidelineRule,
  InternalStyleTraceResult,
  NormalizedInput,
  OriginalityBoundary,
  PromptReadyBrief,
  ReferenceSignature,
  ReviewContract,
  SiteProfile,
  StyleInvariant,
  StyleRisk,
  SoftGuess,
  VariationAxis,
  VisualVocabulary,
  VisualModule,
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

export function synthesizeResult(sites: SiteProfile[], input: NormalizedInput): InternalStyleTraceResult {
  const synthesisSites = input.synthesisMode === "single-site-profile" ? sites.slice(0, 1) : sites;
  const sharedPatterns = collectSharedPatterns(synthesisSites);
  const referenceSignatures = synthesisSites.map(buildReferenceSignature);
  const rules = buildAspectPreservingRules(synthesisSites);
  const visualVocabulary = buildVisualVocabulary(synthesisSites);
  const styleInvariants = buildStyleInvariants(synthesisSites);
  const styleRisks = buildStyleRisks(synthesisSites, styleInvariants, input);
  const softGuesses = buildSoftGuesses(synthesisSites);
  const compositionBlueprint = buildCompositionBlueprint(synthesisSites, input.targetArtifact);
  const variationAxes = buildVariationAxes(synthesisSites, input.synthesisMode);
  const blendModes = buildBlendModes(synthesisSites, sharedPatterns, input.synthesisMode);
  const originalityBoundary = buildOriginalityBoundary(input.targetArtifact);
  const reviewContract = buildReviewContract(synthesisSites, styleInvariants, styleRisks, softGuesses, input.targetArtifact);
  const promptReadyBrief = buildPromptReadyBrief({
    input,
    synthesisSites,
    styleInvariants,
    styleRisks,
    reviewContract,
  });

  return {
    sites,
    visualVocabulary,
    styleInvariants,
    styleRisks,
    softGuesses,
    compositionBlueprint,
    variationAxes,
    blendModes,
    promptReadyBrief,
    reviewContract,
    originalityBoundary,
    synthesis: {
      mode: "aspect-grammar",
      sharedPatterns,
      referenceSignatures,
      blendStrategy: {
        headline: input.synthesisMode === "single-site-profile"
          ? "Preserve the lead reference across all ten designGrammar aspects instead of broadening it into a category average."
          : "Blend only the aspect patterns that genuinely repeat; preserve each reference's strongest aspect signatures explicitly.",
        directives: buildBlendDirectives(synthesisSites, sharedPatterns),
        avoid: styleRisks.map((risk) => risk.risk).slice(0, 4),
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

function buildVisualVocabulary(sites: SiteProfile[]): VisualVocabulary {
  const anchor = sites[0];
  if (!anchor) {
    return {
      typeSystem: { headlineScale: "unknown", headingStyle: "unknown", bodyStyle: "unknown", families: [], confidence: "low" },
      colorSystem: { backgroundMode: "light", contrast: "medium", paletteRestraint: "moderate", accentCount: 0 },
      layoutSystem: { contentWidth: "unknown", sectionRhythm: "unknown", density: "balanced", moduleRhythm: "editorial" },
      componentSystem: {
        navDensity: "minimal",
        headerCtaPattern: "none",
        heroCtaPattern: "none",
        buttonRadius: "soft",
        buttonEmphasis: "mixed",
        cardDensity: "none",
        formStyle: "none",
      },
      imagerySystem: {
        heroMediaStyle: "text-only",
        mediaWeight: "none",
        iconDensity: "low",
        photoPresence: "low",
        illustrationPresence: "low",
        videoPresence: "none",
      },
      motionSystem: {
        motionLevel: "restrained",
        stickyLevel: "none",
        hoverEmphasis: "subtle",
        confidence: "low",
      },
    };
  }

  const heroModules = sites.flatMap((site) => site.capturedPages.map((page) => page.modules.find((module) => module.kind === "hero")).filter((module): module is VisualModule => Boolean(module)));
  const nonHeroModules = sites.flatMap((site) => site.capturedPages.flatMap((page) => page.modules.filter((module) => module.kind !== "hero")));

  return {
    typeSystem: {
      headlineScale: mostCommon(sites.map((site) => site.derivedSignals.reproduction.hero.headingScale)) ?? "moderate",
      headingStyle: mostCommon(sites.map((site) => site.derivedSignals.typography.headingStyle)) ?? anchor.derivedSignals.typography.headingStyle,
      bodyStyle: mostCommon(sites.map((site) => site.derivedSignals.typography.bodyStyle)) ?? anchor.derivedSignals.typography.bodyStyle,
      families: uniqueStrings(sites.flatMap((site) => site.derivedSignals.typography.families)).slice(0, 4),
      confidence: classifyConfidence(
        sites.filter((site) => site.designGrammar.typographyScale.confidence !== "low").length,
        sites.length,
      ),
    },
    colorSystem: {
      backgroundMode: mostCommon(sites.map((site) => site.derivedSignals.colors.backgroundMode)) ?? anchor.derivedSignals.colors.backgroundMode,
      contrast: mostCommon(sites.map((site) => site.derivedSignals.colors.contrast)) ?? anchor.derivedSignals.colors.contrast,
      paletteRestraint: mostCommon(sites.map((site) => site.derivedSignals.colors.paletteRestraint)) ?? anchor.derivedSignals.colors.paletteRestraint,
      accentCount: Math.round(average(sites.map((site) => site.derivedSignals.colors.accentCount))),
    },
    layoutSystem: {
      contentWidth: mostCommon(sites.map((site) => site.derivedSignals.layout.contentWidth)) ?? anchor.derivedSignals.layout.contentWidth,
      sectionRhythm: mostCommon(sites.map((site) => site.derivedSignals.layout.sectionRhythm)) ?? anchor.derivedSignals.layout.sectionRhythm,
      density: mostCommon(sites.map((site) => site.derivedSignals.layout.density)) ?? anchor.derivedSignals.layout.density,
      moduleRhythm: mostCommon(sites.flatMap((site) => site.capturedPages.map((page) => page.visualSignals.visualRhythm))) ?? "editorial",
    },
    componentSystem: {
      navDensity: mostCommon(sites.map((site) => site.derivedSignals.reproduction.header.navDensity)) ?? anchor.derivedSignals.reproduction.header.navDensity,
      headerCtaPattern: mostCommon(sites.map((site) => site.derivedSignals.reproduction.header.ctaPattern)) ?? anchor.derivedSignals.reproduction.header.ctaPattern,
      heroCtaPattern: mostCommon(sites.map((site) => site.derivedSignals.reproduction.hero.ctaPattern)) ?? anchor.derivedSignals.reproduction.hero.ctaPattern,
      buttonRadius: mostCommon(sites.map((site) => site.derivedSignals.reproduction.buttons.radius)) ?? anchor.derivedSignals.reproduction.buttons.radius,
      buttonEmphasis: mostCommon(sites.map((site) => site.derivedSignals.reproduction.buttons.emphasis)) ?? anchor.derivedSignals.reproduction.buttons.emphasis,
      cardDensity: mostCommon(nonHeroModules.map((module) => module.cardDensity)) ?? "none",
      formStyle: mostCommon(sites.map((site) => site.derivedSignals.forms.fieldStyle)) ?? "none",
    },
    imagerySystem: {
      heroMediaStyle: mostCommon(sites.map((site) => site.derivedSignals.reproduction.hero.mediaStyle)) ?? anchor.derivedSignals.reproduction.hero.mediaStyle,
      mediaWeight: mostCommon(heroModules.map((module) => module.mediaWeight)) ?? "none",
      iconDensity: mostCommon(sites.map((site) => site.derivedSignals.imagery.iconDensity)) ?? anchor.derivedSignals.imagery.iconDensity,
      photoPresence: mostCommon(sites.map((site) => site.derivedSignals.imagery.photoPresence)) ?? anchor.derivedSignals.imagery.photoPresence,
      illustrationPresence: mostCommon(sites.map((site) => site.derivedSignals.imagery.illustrationPresence)) ?? anchor.derivedSignals.imagery.illustrationPresence,
      videoPresence: mostCommon(sites.map((site) => site.derivedSignals.imagery.videoPresence)) ?? anchor.derivedSignals.imagery.videoPresence,
    },
    motionSystem: {
      motionLevel: mostCommon(sites.map((site) => site.derivedSignals.motion.motionLevel)) ?? anchor.derivedSignals.motion.motionLevel,
      stickyLevel: mostCommon(sites.map((site) => site.derivedSignals.motion.stickyLevel)) ?? anchor.derivedSignals.motion.stickyLevel,
      hoverEmphasis: mostCommon(sites.map((site) => site.derivedSignals.motion.hoverEmphasis)) ?? anchor.derivedSignals.motion.hoverEmphasis,
      confidence: classifyConfidence(
        sites.filter((site) => site.designGrammar.microInteractions.confidence !== "low").length,
        sites.length,
      ),
    },
  };
}

function buildStyleInvariants(sites: SiteProfile[]): StyleInvariant[] {
  if (sites.length === 0) {
    return [];
  }

  const first = sites[0]!;
  const heroModules = sites.flatMap((site) => site.capturedPages.map((page) => page.modules.find((module) => module.kind === "hero")).filter((module): module is VisualModule => Boolean(module)));
  const visualHierarchyEvidence = evidenceCountFor(sites, "visualHierarchy");
  const colorEvidence = evidenceCountFor(sites, "colorArchitecture");
  const navEvidence = evidenceCountFor(sites, "navigationLogic");
  const spacingEvidence = evidenceCountFor(sites, "gridAndSpacing");
  const imageryEvidence = evidenceCountFor(sites, "iconographyAndImagery");
  const componentEvidence = evidenceCountFor(sites, "componentStates");
  const heroAlignment = mostCommon(heroModules.map((module) => module.visualProfile.alignment)) ?? "mixed";
  const heroWhitespace = mostCommon(heroModules.map((module) => module.visualProfile.whitespace)) ?? "moderate";
  const heroMediaWeight = mostCommon(heroModules.map((module) => module.mediaWeight)) ?? "none";
  const moduleRhythm = mostCommon(sites.flatMap((site) => site.capturedPages.map((page) => page.visualSignals.visualRhythm))) ?? "editorial";
  const cardDensity = mostCommon(sites.flatMap((site) => site.capturedPages.flatMap((page) => page.modules.map((module) => module.cardDensity)))) ?? "none";

  const invariants: StyleInvariant[] = [];
  pushInvariant(invariants, {
    id: "visual-hierarchy",
    rule: `Preserve ${first.derivedSignals.reproduction.hero.headingScale} first-screen hierarchy with ${heroAlignment} hero composition and ${heroWhitespace} spacing.`,
    appliesTo: ["hero", "visualHierarchy", "gridAndSpacing"],
    strength: "hard",
    confidence: classifyConfidence(visualHierarchyEvidence, sites.length),
    evidenceCount: visualHierarchyEvidence,
  });
  pushInvariant(invariants, {
    id: "color-architecture",
    rule: `Keep the ${first.derivedSignals.colors.paletteRestraint} palette on ${first.derivedSignals.colors.backgroundMode} surfaces with ${first.derivedSignals.colors.contrast} contrast.`,
    appliesTo: ["colorArchitecture"],
    strength: "hard",
    confidence: classifyConfidence(colorEvidence, sites.length),
    evidenceCount: colorEvidence,
  });
  pushInvariant(invariants, {
    id: "navigation-logic",
    rule: `Maintain ${first.derivedSignals.reproduction.header.navDensity} navigation with ${first.derivedSignals.reproduction.header.ctaPattern} header CTA behavior.`,
    appliesTo: ["navigation", "navigationLogic"],
    strength: "hard",
    confidence: classifyConfidence(navEvidence, sites.length),
    evidenceCount: navEvidence,
  });
  pushInvariant(invariants, {
    id: "module-rhythm",
    rule: `Keep ${moduleRhythm} module pacing with ${first.derivedSignals.layout.density} density and ${first.derivedSignals.layout.contentWidth}.`,
    appliesTo: ["layout", "gridAndSpacing"],
    strength: "hard",
    confidence: classifyConfidence(spacingEvidence, sites.length),
    evidenceCount: spacingEvidence,
  });
  pushInvariant(invariants, {
    id: "imagery-treatment",
    rule: `Preserve ${first.derivedSignals.reproduction.hero.mediaStyle} imagery treatment with ${heroMediaWeight} hero media weight.`,
    appliesTo: ["hero", "iconographyAndImagery"],
    strength: "hard",
    confidence: classifyConfidence(imageryEvidence, sites.length),
    evidenceCount: imageryEvidence,
  });
  pushInvariant(invariants, {
    id: "component-treatment",
    rule: `Keep ${first.derivedSignals.reproduction.buttons.radius} button radius, ${first.derivedSignals.reproduction.buttons.emphasis} emphasis, and ${cardDensity} card density.`,
    appliesTo: ["componentStates"],
    strength: "soft",
    confidence: classifyConfidence(componentEvidence, sites.length),
    evidenceCount: componentEvidence,
  });

  return invariants.slice(0, 6);
}

function buildStyleRisks(sites: SiteProfile[], invariants: StyleInvariant[], input: NormalizedInput): StyleRisk[] {
  if (sites.length === 0) {
    return [];
  }

  const first = sites[0]!;
  const risks: StyleRisk[] = [
    {
      id: "generic-template-drift",
      risk: "Do not flatten the references into a generic premium-tech or SaaS template.",
      reason: "The extracted hierarchy, color architecture, and navigation logic are specific enough to preserve directly.",
      severity: "high",
    },
    {
      id: "unsupported-motion",
      risk: "Do not invent strong motion or interaction behavior beyond the observed evidence.",
      reason: "Micro-interactions are inferred more weakly than hierarchy, color, and composition.",
      severity: first.designGrammar.microInteractions.confidence === "low" ? "high" : "medium",
    },
    {
      id: "unsupported-breakpoints",
      risk: "Do not over-assert breakpoint behavior that is not clearly supported by the reference evidence.",
      reason: "Responsive behavior is still inferred from limited probing and should stay subordinate to layout structure.",
      severity: first.designGrammar.responsiveBreakpoints.confidence === "low" ? "high" : "medium",
    },
    {
      id: "over-cardification",
      risk: "Do not convert editorial or open sections into uniformly rounded card stacks.",
      reason: "The extracted spacing and module rhythm would be lost if every section became a card grid.",
      severity: first.derivedSignals.layout.sectionRhythm.includes("editorial") || invariants.some((item) => item.id === "module-rhythm") ? "medium" : "low",
    },
    {
      id: "decorative-gradient-drift",
      risk: "Do not add decorative gradients or accent overload unless the extracted color architecture supports it.",
      reason: `The references point to a ${first.derivedSignals.colors.paletteRestraint} palette with ${first.derivedSignals.colors.accentCount} accent bucket(s).`,
      severity: first.derivedSignals.colors.paletteRestraint === "restrained" ? "high" : "medium",
    },
    {
      id: "target-mismatch",
      risk: `Do not let ${input.targetArtifact} requirements override the strongest style signals from the references.`,
      reason: "Target-aware synthesis should shape priorities, not rewrite the source vocabulary.",
      severity: "medium",
    },
  ];

  return risks.slice(0, 6);
}

function buildSoftGuesses(sites: SiteProfile[]): SoftGuess[] {
  if (sites.length === 0) {
    return [];
  }

  const guesses: SoftGuess[] = [];
  for (const area of ASPECT_KEYS) {
    const evidenceCount = sites.filter((site) => site.designGrammar[area].confidence === "low").length;
    if (evidenceCount === 0) {
      continue;
    }

    guesses.push({
      id: `soft-${area}`,
      area,
      guidance: softGuidanceFor(area),
      confidence: "low",
    });
  }
  return guesses.slice(0, 4);
}

function buildCompositionBlueprint(sites: SiteProfile[], targetArtifact: NormalizedInput["targetArtifact"]): CompositionBlueprintStep[] {
  return sites.flatMap((site) => site.capturedPages.flatMap((page) => page.modules.slice(0, 6).map((module) => ({
    siteUrl: site.url,
    pagePath: page.path,
    module: module.kind,
    role: moduleRole(module.kind, targetArtifact),
    layout: `${module.visualProfile.alignment} / ${module.visualProfile.balance}`,
    emphasis: module.emphasis,
    mediaRole: module.mediaWeight,
    spacing: module.visualProfile.whitespace,
    surface: `${module.visualProfile.backgroundMode} ${module.visualProfile.surfaceStyle}`,
    ctaBehavior: page.heroCtaPattern,
    preserve: preserveNotesForModule(module),
    adaptationNotes: adaptationNotesForModule(module, targetArtifact),
  })))).slice(0, 10);
}

function buildVariationAxes(sites: SiteProfile[], synthesisMode: NormalizedInput["synthesisMode"]): VariationAxis[] {
  if (synthesisMode === "single-site-profile") {
    return [];
  }

  const axes: VariationAxis[] = [];
  pushVariationAxis(axes, "density", sites.map((site) => site.derivedSignals.layout.density), "Balance density only within the observed range.");
  pushVariationAxis(axes, "mediaWeight", sites.map((site) => site.derivedSignals.reproduction.hero.mediaStyle), "Use media weighting to preserve reference differences above the fold.");
  pushVariationAxis(axes, "colorExpression", sites.map((site) => site.derivedSignals.colors.paletteRestraint), "Do not average restrained and varied palettes into a decorative middle ground.");
  pushVariationAxis(axes, "chromeVisibility", sites.flatMap((site) => site.capturedPages.map((page) => page.visualSignals.chromeVisibility)), "Navigation chrome varies materially across the references.");
  pushVariationAxis(axes, "moduleRhythm", sites.flatMap((site) => site.capturedPages.map((page) => page.visualSignals.visualRhythm)), "Module rhythm is a strong differentiator in cross-site blends.");
  pushVariationAxis(axes, "ctaPressure", sites.map((site) => site.derivedSignals.reproduction.hero.ctaPattern), "CTA pressure should track the strongest reference rather than a category default.");
  return axes.slice(0, 6);
}

function buildBlendModes(
  sites: SiteProfile[],
  sharedPatterns: Array<{ aspect: DesignAspectKey; summary: string }>,
  synthesisMode: NormalizedInput["synthesisMode"],
): BlendMode[] {
  if (sites.length === 0) {
    return [];
  }

  if (synthesisMode === "single-site-profile") {
    return [{
      mode: "lead-reference",
      headline: "Use the lead reference as the direct style anchor.",
      directives: buildBlendDirectives(sites, sharedPatterns).slice(0, 4),
    }];
  }

  return [
    {
      mode: "lead-reference",
      headline: `Anchor on ${sites[0]?.url} and borrow only supporting motifs from the remaining references.`,
      directives: buildBlendDirectives(sites.slice(0, 2), sharedPatterns).slice(0, 5),
    },
    {
      mode: "common-core",
      headline: "Preserve only the aspect patterns that genuinely repeat across the references.",
      directives: sharedPatterns.map((pattern) => `${pattern.aspect}: ${pattern.summary}`).slice(0, 5),
    },
    {
      mode: "contrast-set",
      headline: "Keep the references distinct and explore multiple variants instead of averaging them away.",
      directives: sites.slice(0, 3).map((site) => {
        const strongest = rankStrongestAspects(site.designGrammar).slice(0, 2).join(", ");
        return `From ${site.url}, keep the strongest aspects legible: ${strongest}.`;
      }),
    },
  ];
}

function buildPromptReadyBrief(input: {
  input: NormalizedInput;
  synthesisSites: SiteProfile[];
  styleInvariants: StyleInvariant[];
  styleRisks: StyleRisk[];
  reviewContract: ReviewContract;
}): PromptReadyBrief {
  const { input: normalized, synthesisSites, styleInvariants, styleRisks, reviewContract } = input;
  const first = synthesisSites[0];
  const summary = first
    ? `${articleFor(first.derivedSignals.colors.paletteRestraint)} ${first.derivedSignals.colors.paletteRestraint}, ${first.derivedSignals.reproduction.hero.mediaStyle} ${normalized.targetArtifact} style with ${first.derivedSignals.layout.sectionRhythm} and ${first.derivedSignals.reproduction.header.navDensity} navigation.`
    : `Prompt-ready guidance for a ${normalized.targetArtifact}.`;

  return {
    summary,
    targetArtifact: normalized.targetArtifact,
    fidelity: normalized.fidelity,
    ...(normalized.designIntent ? { designIntent: normalized.designIntent } : {}),
    buildPriorities: styleInvariants.map((item) => item.rule).slice(0, 4),
    do: uniqueStrings([
      ...styleInvariants.map((item) => item.rule),
      ...synthesisSites.flatMap((site) => site.designGrammar.reconstructionDirectives),
    ]).slice(0, 4),
    avoid: styleRisks.map((risk) => risk.risk).slice(0, 4),
    reviewChecklist: reviewContract.mustMatch.map((item) => item.rule).slice(0, 4),
  };
}

function buildReviewContract(
  sites: SiteProfile[],
  styleInvariants: StyleInvariant[],
  styleRisks: StyleRisk[],
  softGuesses: SoftGuess[],
  targetArtifact: NormalizedInput["targetArtifact"],
): ReviewContract {
  return {
    mustMatch: styleInvariants.filter((item) => item.strength === "hard").slice(0, 5),
    mustAvoid: styleRisks.filter((item) => item.severity !== "low").slice(0, 4),
    compareAgainst: uniqueStrings([
      ...sites.flatMap((site) => site.pagesAnalyzed),
      ...sites.flatMap((site) => site.designGrammar.signatureMotifs.map((motif) => motif.label)),
    ]).slice(0, 6),
    viewportChecks: viewportChecksFor(targetArtifact),
    uncertainAreas: softGuesses.map((item) => item.guidance).slice(0, 4),
  };
}

function buildOriginalityBoundary(targetArtifact: NormalizedInput["targetArtifact"]): OriginalityBoundary {
  return {
    safeToReuse: [
      "Hierarchy, spacing rhythm, density, and layout balance.",
      "General color restraint, contrast strategy, and component weight.",
      `Structural lessons that make the ${targetArtifact} feel visually coherent.`,
    ],
    doNotCopy: [
      "Logos, brand names, proprietary copy, and trademarked product framing.",
      "Exact product imagery, custom illustrations, and protected photography.",
      "Highly distinctive one-to-one page composition when it reads as brand-specific expression.",
    ],
    adaptationGuidance: [
      "Preserve structural and stylistic lessons while using original content and assets.",
      "Treat StyleTrace output as a design brief, not a copy mandate.",
    ],
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

function evidenceCountFor(sites: SiteProfile[], aspect: DesignAspectKey): number {
  return sites.filter((site) => site.designGrammar[aspect].confidence !== "low").length;
}

function softGuidanceFor(area: DesignAspectKey): string {
  switch (area) {
    case "microInteractions":
      return "Use restrained hover and transition behavior unless stronger motion evidence is available.";
    case "responsiveBreakpoints":
      return "Preserve composition and density rather than inventing breakpoint rules beyond the observed evidence.";
    case "formAndInputDesign":
      return "Use neutral, legible form treatment unless the references clearly expose stronger form patterns.";
    case "typographyScale":
      return "Treat typography as approximate when the reference evidence is image-led or text-light.";
    default:
      return `Treat ${area} as a soft inference rather than a hard requirement.`;
  }
}

function moduleRole(kind: CompositionBlueprintStep["module"], targetArtifact: NormalizedInput["targetArtifact"]): string {
  if (kind === "hero") {
    return targetArtifact === "landing-page" ? "first-screen positioning and conversion" : "entry framing and orientation";
  }
  if (kind === "navigation") {
    return "orientation and movement across the artifact";
  }
  if (kind === "pricing" || kind === "comparison") {
    return "offer framing and decision support";
  }
  if (kind === "proof") {
    return "credibility and trust framing";
  }
  if (kind === "cta") {
    return "conversion or next-step emphasis";
  }
  return "body structure and pacing";
}

function preserveNotesForModule(module: VisualModule): string[] {
  return uniqueStrings([
    `${module.visualProfile.alignment} alignment`,
    `${module.visualProfile.whitespace} spacing`,
    module.mediaWeight !== "none" ? `${module.mediaWeight} media role` : "",
    module.hasPrimaryAction ? "visible primary action" : "",
  ]).slice(0, 4);
}

function adaptationNotesForModule(module: VisualModule, targetArtifact: NormalizedInput["targetArtifact"]): string[] {
  const notes = [`Preserve the rhythm and balance of this ${module.kind} module for the ${targetArtifact}.`];
  if (module.kind === "hero") {
    notes.push("Use original content and assets while keeping the first-screen composition intact.");
  }
  if (module.cardDensity === "heavy") {
    notes.push("Keep repeated item density coherent instead of collapsing into a single generic content block.");
  }
  return notes;
}

function viewportChecksFor(targetArtifact: NormalizedInput["targetArtifact"]): string[] {
  const checks = [
    "Desktop first screen preserves hierarchy and navigation density.",
    "Mobile preserves module order and primary action clarity.",
  ];
  if (targetArtifact === "landing-page") {
    checks.push("Hero leaves a visible hint of the next section on common desktop and mobile viewports.");
  }
  if (targetArtifact === "product-ui") {
    checks.push("Interface density remains usable without collapsing into card-heavy marketing composition.");
  }
  return checks;
}

function pushInvariant(invariants: StyleInvariant[], invariant: StyleInvariant): void {
  if (invariant.evidenceCount === 0 || invariant.confidence === "low") {
    return;
  }
  invariants.push(invariant);
}

function pushVariationAxis(
  axes: VariationAxis[],
  axis: VariationAxis["axis"],
  rawOptions: string[],
  rationale: string,
): void {
  const options = uniqueStrings(rawOptions);
  if (options.length <= 1) {
    return;
  }
  axes.push({
    axis,
    options,
    recommended: options[0] ?? "",
    rationale,
  });
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

function classifyConfidence(evidenceCount: number, totalSites: number): Confidence {
  if (totalSites <= 0) {
    return "low";
  }
  if (evidenceCount === totalSites) {
    return "high";
  }
  if (evidenceCount >= Math.max(1, Math.ceil(totalSites / 2))) {
    return "medium";
  }
  return "low";
}

function articleFor(value: string): "a" | "an" {
  return /^[aeiou]/i.test(value) ? "an" : "a";
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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
