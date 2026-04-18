import { ctaPressure, heroSignature } from "./moduleSegmentation.js";
import type {
  CapturedPage,
  Confidence,
  DesignAspect,
  DesignAspectKey,
  DerivedDesignSignals,
  PageEvidence,
  PageSnapshot,
  SiteDesignGrammar,
  SiteMotif,
} from "../core/types.js";

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

export function buildDesignGrammar(input: {
  snapshots: PageSnapshot[];
  pageEvidence: PageEvidence[];
  capturedPages: CapturedPage[];
  signals: DerivedDesignSignals;
}): SiteDesignGrammar {
  const { snapshots, pageEvidence, capturedPages, signals } = input;
  const heroPaths = evidencePathsFor(pageEvidence, (page) => page.sectionOrder.includes("hero"));
  const pricingPaths = evidencePathsFor(pageEvidence, (page) => page.sectionOrder.includes("pricing") || page.intent === "pricing" || page.intent === "product");
  const proofPaths = evidencePathsFor(pageEvidence, (page) => page.sectionOrder.includes("proof"));
  const featurePaths = evidencePathsFor(pageEvidence, (page) => page.sectionOrder.includes("features"));
  const allPaths = uniqueStrings(pageEvidence.map((page) => page.path));
  const heroModules = capturedPages
    .map((page) => page.modules.find((module) => module.kind === "hero"))
    .filter((module): module is NonNullable<typeof module> => Boolean(module));
  const nonHeroModules = capturedPages.flatMap((page) => page.modules.filter((module) => module.kind !== "hero" && module.kind !== "navigation" && module.kind !== "footer"));

  const heroAlignment = mostCommon(heroModules.map((module) => module.visualProfile.alignment)) ?? "mixed";
  const heroBalance = mostCommon(heroModules.map((module) => module.visualProfile.balance)) ?? "balanced";
  const heroWhitespace = mostCommon(heroModules.map((module) => module.visualProfile.whitespace)) ?? "moderate";
  const heroSurface = mostCommon(heroModules.map((module) => module.visualProfile.surfaceStyle)) ?? "flat";
  const heroDominance = average(capturedPages.map((page) => page.visualSignals.heroDominance));
  const chromeVisibility = mostCommon(capturedPages.map((page) => page.visualSignals.chromeVisibility)) ?? "medium";
  const visualRhythm = mostCommon(capturedPages.map((page) => page.visualSignals.visualRhythm)) ?? "editorial";
  const dominantMedia = average(capturedPages.map((page) => heroSignature(page).mediaWeight === "dominant" ? 2 : heroSignature(page).mediaWeight === "supporting" ? 1 : 0));
  const centeredModules = nonHeroModules.filter((module) => module.visualProfile.alignment === "centered").length;
  const openModules = nonHeroModules.filter((module) => module.visualProfile.whitespace === "open").length;
  const sectionCount = Math.max(1, snapshots.reduce((sum, snapshot) => sum + snapshot.sectionCandidates.length, 0));
  const avgIconCount = average(snapshots.map((snapshot) => snapshot.imagerySignals.iconCount));
  const avgPhotoLikeCount = average(snapshots.map((snapshot) => snapshot.imagerySignals.photoLikeMediaCount));
  const avgIllustrationCount = average(snapshots.map((snapshot) => snapshot.imagerySignals.illustrationLikeCount));
  const avgVideoCount = average(snapshots.map((snapshot) => snapshot.imagerySignals.videoCount));
  const avgAnimatedCount = average(snapshots.map((snapshot) => snapshot.interactionSignals.animatedElementCount));
  const avgTransitionCount = average(snapshots.map((snapshot) => snapshot.interactionSignals.transitionElementCount));
  const avgStickyCount = average(snapshots.map((snapshot) => snapshot.interactionSignals.stickyElementCount));
  const avgHoverableActions = average(snapshots.map((snapshot) => snapshot.interactionSignals.hoverableActionCount));
  const formRichness = average(snapshots.map((snapshot) => snapshot.formSignals.inputCount + snapshot.formSignals.textareaCount + snapshot.formSignals.selectCount));
  const labeledFieldRatio = average(snapshots.map((snapshot) => {
    const total = snapshot.formSignals.inputCount + snapshot.formSignals.textareaCount + snapshot.formSignals.selectCount;
    return total > 0 ? snapshot.formSignals.labeledFieldCount / total : 0;
  }));
  const fieldRadiusMedian = average(snapshots.map((snapshot) => snapshot.formSignals.fieldRadiusMedian));
  const fieldStyle = mostCommon(snapshots.map((snapshot) => snapshot.formSignals.fieldStyle)) ?? "none";
  const mobileNavCount = average(snapshots.map((snapshot) => snapshot.responsiveProbe.mobileNavLinkCount));
  const mobileMenuTriggers = average(snapshots.map((snapshot) => snapshot.responsiveProbe.mobileMenuTriggerCount));
  const mobileMultiColumnCount = average(snapshots.map((snapshot) => snapshot.responsiveProbe.mobileMultiColumnSectionCount));
  const mobileActionCount = average(snapshots.map((snapshot) => snapshot.responsiveProbe.mobilePrimaryActionCount));

  const visualHierarchy = buildAspect(
    `${describeHeroWeight(heroDominance)} first-screen hierarchy with ${heroAlignment} hero composition and ${chromeVisibility} chrome visibility.`,
    [
      `Hero balance resolves as ${heroBalance}.`,
      `Hero spacing reads as ${heroWhitespace}.`,
      `Down-page rhythm trends ${visualRhythm}.`,
    ],
    heroPaths.length > 0 ? heroPaths : allPaths,
    confidenceFromRatio(heroPaths.length, pageEvidence.length),
  );

  const typographyScale = buildAspect(
    `${signals.reproduction.hero.headingScale} headline system over ${signals.typography.scale}.`,
    [
      `Heading style: ${signals.typography.headingStyle}.`,
      `Body style: ${signals.typography.bodyStyle}.`,
      `Families observed: ${signals.typography.families.join(", ")}.`,
    ],
    heroPaths.length > 0 ? heroPaths : allPaths,
    confidenceFromRatio(snapshots.filter((snapshot) => snapshot.headings.length > 0).length, snapshots.length),
  );

  const colorArchitecture = buildAspect(
    `${signals.colors.paletteRestraint} color system with ${signals.colors.contrast} contrast on ${signals.colors.backgroundMode} surfaces.`,
    [
      `${signals.colors.accentCount} accent bucket(s) recur across the analyzed page(s).`,
      `Hero surfaces read as ${heroSurface}.`,
      `Body background mode is ${signals.colors.backgroundMode}.`,
    ],
    heroPaths.length > 0 ? heroPaths : allPaths,
    confidenceFromRatio(snapshots.length, snapshots.length),
  );

  const gridAndSpacing = buildAspect(
    `${signals.layout.contentWidth} with ${signals.layout.sectionRhythm} and ${signals.layout.density} density.`,
    [
      `${openModules > 0 ? "Open" : "Moderate"} spacing appears in ${openModules}/${sectionCount} non-hero modules.`,
      `${centeredModules > 0 ? "Centered" : "Left-led"} secondary modules are more common below the hero.`,
      `Module sequence begins ${capturedPages[0]?.moduleSequence.slice(0, 5).join(" -> ") ?? signals.layout.structure.join(" -> ")}.`,
    ],
    featurePaths.length > 0 ? featurePaths : allPaths,
    confidenceFromRatio(nonHeroModules.length, sectionCount),
  );

  const iconographyAndImagery = buildAspect(
    describeImagerySummary({
      dominantMedia,
      avgIconCount,
      avgPhotoLikeCount,
      avgIllustrationCount,
      avgVideoCount,
    }),
    [
      `Hero media style: ${signals.reproduction.hero.mediaStyle}.`,
      `Hero balance: ${heroBalance}.`,
      `Average icon density: ${Math.round(avgIconCount)}; photo-like media: ${Math.round(avgPhotoLikeCount)}; illustration-like media: ${Math.round(avgIllustrationCount)}.`,
      `Video surfaces average ${Math.round(avgVideoCount)} per page.`,
    ],
    heroPaths.length > 0 ? heroPaths : allPaths,
    confidenceFromRatio(
      snapshots.filter((snapshot) => snapshot.imagerySignals.iconCount + snapshot.imagerySignals.photoLikeMediaCount + snapshot.imagerySignals.illustrationLikeCount > 0).length,
      snapshots.length,
    ),
  );

  const componentStates = buildAspect(
    `${signals.components.buttons}; CTAs are ${signals.components.ctaPresence}.`,
    [
      `Button radius trends ${signals.reproduction.buttons.radius}.`,
      `Button emphasis trends ${signals.reproduction.buttons.emphasis}.`,
      `Button size trends ${signals.reproduction.buttons.size}.`,
    ],
    allPaths,
    confidenceFromRatio(snapshots.filter((snapshot) => snapshot.actions.length > 0).length, snapshots.length),
  );

  const navigationLogic = buildAspect(
    `${signals.components.nav} with ${chromeVisibility} visual chrome visibility.`,
    [
      `Header CTA pattern: ${signals.reproduction.header.ctaPattern}.`,
      `Navigation density: ${signals.reproduction.header.navDensity}.`,
      `Footer behavior: ${signals.components.footer}.`,
    ],
    allPaths,
    confidenceFromRatio(capturedPages.length, capturedPages.length),
  );

  const microInteractions = buildAspect(
    inferMicroInteractionSummary(signals, capturedPages, {
      avgAnimatedCount,
      avgTransitionCount,
      avgStickyCount,
      avgHoverableActions,
    }),
    [
      `Average animated elements: ${Math.round(avgAnimatedCount)}; transitioned elements: ${Math.round(avgTransitionCount)}.`,
      `Sticky/fixed elements average ${Math.round(avgStickyCount)}; hoverable action affordances average ${Math.round(avgHoverableActions)}.`,
      `Hero CTA pattern: ${signals.reproduction.hero.ctaPattern}.`,
      `Commerce pressure: ${signals.reproduction.commerce.pricingPresence}.`,
    ],
    heroPaths.length > 0 ? heroPaths : allPaths,
    confidenceFromRatio(
      snapshots.filter((snapshot) => snapshot.interactionSignals.animatedElementCount + snapshot.interactionSignals.transitionElementCount > 0).length,
      snapshots.length,
    ),
  );

  const formAndInputDesign = buildAspect(
    inferFormSummary(signals, pricingPaths, allPaths, {
      formRichness,
      labeledFieldRatio,
      fieldRadiusMedian,
      fieldStyle,
    }),
    [
      `Visible form-field count averages ${Math.round(formRichness)} with ${(labeledFieldRatio * 100).toFixed(0)}% labeled coverage.`,
      `Field radius median is ${Math.round(fieldRadiusMedian)}px with ${fieldStyle} treatment.`,
      `Pricing presence: ${signals.reproduction.commerce.pricingPresence}.`,
      `Primary-action pattern: ${signals.reproduction.hero.ctaPattern}.`,
    ],
    pricingPaths.length > 0 ? pricingPaths : allPaths,
    confidenceFromRatio(
      snapshots.filter((snapshot) => snapshot.formSignals.formCount > 0 || snapshot.formSignals.inputCount + snapshot.formSignals.textareaCount + snapshot.formSignals.selectCount > 0).length,
      snapshots.length,
    ),
  );

  const responsiveBreakpoints = buildAspect(
    inferResponsiveSummary({
      desktopWidth: capturedPages[0]?.viewport.width ?? 1440,
      mobileNavCount,
      mobileMenuTriggers,
      mobileMultiColumnCount,
      mobileActionCount,
    }),
    [
      `Primary viewport analyzed at ${capturedPages[0]?.viewport.width ?? 1440}px wide.`,
      `Mobile nav links average ${Math.round(mobileNavCount)} with ${Math.round(mobileMenuTriggers)} menu triggers.`,
      `Mobile multi-column sections average ${Math.round(mobileMultiColumnCount)} and primary actions average ${Math.round(mobileActionCount)}.`,
      `Content framing: ${signals.layout.contentWidth}.`,
    ],
    allPaths,
    "medium",
  );

  const signatureMotifs = buildSignatureMotifs({
    heroPaths,
    pricingPaths,
    proofPaths,
    featurePaths,
    allPaths,
    signals,
    heroAlignment,
    heroBalance,
    heroWhitespace,
    chromeVisibility,
    visualRhythm,
    heroDominance,
    dominantMedia,
  });

  return {
    model: "ten-aspect-v1",
    visualHierarchy,
    typographyScale,
    colorArchitecture,
    gridAndSpacing,
    iconographyAndImagery,
    componentStates,
    navigationLogic,
    microInteractions,
    formAndInputDesign,
    responsiveBreakpoints,
    signatureMotifs: signatureMotifs.slice(0, 6),
    reconstructionDirectives: buildReconstructionDirectives({
      visualHierarchy,
      colorArchitecture,
      gridAndSpacing,
      iconographyAndImagery,
      navigationLogic,
      formAndInputDesign,
    }),
  };
}

export function rankStrongestAspects(designGrammar: SiteDesignGrammar): DesignAspectKey[] {
  return ASPECT_KEYS
    .map((key) => ({ key, aspect: designGrammar[key] }))
    .sort((left, right) => confidenceRank(right.aspect.confidence) - confidenceRank(left.aspect.confidence))
    .slice(0, 3)
    .map((entry) => entry.key);
}

function buildAspect(summary: string, observations: string[], evidencePaths: string[], confidence: Confidence): DesignAspect {
  return {
    summary,
    observations: uniqueStrings(observations.filter(Boolean)).slice(0, 4),
    evidencePaths: uniqueStrings(evidencePaths).slice(0, 4),
    confidence,
  };
}

function buildSignatureMotifs(input: {
  heroPaths: string[];
  pricingPaths: string[];
  proofPaths: string[];
  featurePaths: string[];
  allPaths: string[];
  signals: DerivedDesignSignals;
  heroAlignment: string;
  heroBalance: string;
  heroWhitespace: string;
  chromeVisibility: string;
  visualRhythm: string;
  heroDominance: number;
  dominantMedia: number;
}): SiteMotif[] {
  const motifs: SiteMotif[] = [];
  pushMotif(motifs, {
    condition: input.heroPaths.length > 0,
    label: `${input.heroAlignment} hero with ${input.heroWhitespace} spacing and ${input.heroBalance} balance`,
    rationale: `Visual hierarchy is set by a ${input.heroAlignment} hero whose balance is ${input.heroBalance}.`,
    evidencePaths: input.heroPaths,
    strength: input.heroDominance >= 0.45 ? "signature" : "supporting",
  });
  pushMotif(motifs, {
    condition: true,
    label: `${input.signals.colors.paletteRestraint} palette on ${input.signals.colors.backgroundMode} surfaces`,
    rationale: `Color architecture stays ${input.signals.colors.paletteRestraint} with ${input.signals.colors.contrast} contrast.`,
    evidencePaths: input.heroPaths.length > 0 ? input.heroPaths : input.allPaths,
    strength: input.signals.colors.paletteRestraint === "restrained" ? "signature" : "supporting",
  });
  pushMotif(motifs, {
    condition: input.featurePaths.length > 0,
    label: `${input.visualRhythm} module pacing after the hero`,
    rationale: `Grid and spacing read as ${input.visualRhythm} rather than neutral marketing rhythm.`,
    evidencePaths: input.featurePaths,
    strength: "supporting",
  });
  pushMotif(motifs, {
    condition: input.pricingPaths.length > 0,
    label: `${input.signals.reproduction.commerce.pricingPresence} pricing exposure`,
    rationale: `Form, pricing, and CTA structure expose commerce as ${input.signals.reproduction.commerce.pricingPresence}.`,
    evidencePaths: input.pricingPaths,
    strength: input.signals.reproduction.commerce.pricingPresence === "none" ? "supporting" : "signature",
  });
  pushMotif(motifs, {
    condition: input.proofPaths.length > 0,
    label: input.signals.reproduction.hero.proofNearTop ? "proof surfaces early in the scroll" : "proof is deferred behind product framing",
    rationale: `Proof modules ${input.signals.reproduction.hero.proofNearTop ? "appear near the hero" : "do not dominate the opening flow"}.`,
    evidencePaths: input.proofPaths,
    strength: "supporting",
  });
  pushMotif(motifs, {
    condition: input.heroPaths.length > 0,
    label: input.chromeVisibility === "low" ? "chrome stays recessive against the hero" : "chrome remains visible in the opening frame",
    rationale: `Navigation logic exposes ${input.chromeVisibility} chrome visibility.`,
    evidencePaths: input.heroPaths,
    strength: input.chromeVisibility === "low" ? "signature" : "supporting",
  });
  pushMotif(motifs, {
    condition: input.heroPaths.length > 0,
    label: input.dominantMedia >= 1.5 ? "imagery dominates the visual narrative" : "imagery supports copy without fully dominating",
    rationale: `Iconography and imagery signals trend ${input.dominantMedia >= 1.5 ? "media-led" : "balanced"}.`,
    evidencePaths: input.heroPaths,
    strength: input.dominantMedia >= 1.5 ? "signature" : "supporting",
  });
  return motifs;
}

function buildReconstructionDirectives(input: {
  visualHierarchy: DesignAspect;
  colorArchitecture: DesignAspect;
  gridAndSpacing: DesignAspect;
  iconographyAndImagery: DesignAspect;
  navigationLogic: DesignAspect;
  formAndInputDesign: DesignAspect;
}): string[] {
  return uniqueStrings([
    `Preserve visual hierarchy: ${input.visualHierarchy.summary}`,
    `Preserve color architecture: ${input.colorArchitecture.summary}`,
    `Preserve grid and spacing: ${input.gridAndSpacing.summary}`,
    `Preserve imagery treatment: ${input.iconographyAndImagery.summary}`,
    `Preserve navigation logic: ${input.navigationLogic.summary}`,
    `Preserve form and input behavior: ${input.formAndInputDesign.summary}`,
  ]).slice(0, 6);
}

function evidencePathsFor(pageEvidence: PageEvidence[], predicate: (page: PageEvidence) => boolean): string[] {
  return pageEvidence.filter(predicate).map((page) => page.path);
}

function inferMicroInteractionSummary(
  derivedSignals: DerivedDesignSignals,
  capturedPages: CapturedPage[],
  metrics: {
    avgAnimatedCount: number;
    avgTransitionCount: number;
    avgStickyCount: number;
    avgHoverableActions: number;
  },
): string {
  const repeatedHeroCtas = capturedPages.filter((page) => ctaPressure(page) === "repeated").length;
  if (metrics.avgAnimatedCount >= 8 || metrics.avgTransitionCount >= 12) {
    return "Interaction cues suggest an actively animated interface with visible hover and transition behavior.";
  }
  if (metrics.avgStickyCount >= 1 || metrics.avgHoverableActions >= 4) {
    return "Interaction cues suggest moderate micro-interaction layering through sticky chrome and hover-aware actions.";
  }
  if (repeatedHeroCtas > 0 || derivedSignals.reproduction.header.ctaPattern === "multiple-primary") {
    return "Interaction cues suggest assertive CTA emphasis and repeated engagement prompts.";
  }
  if (derivedSignals.reproduction.buttons.emphasis === "solid") {
    return "Interaction cues suggest strong primary-action emphasis with limited secondary motion inference.";
  }
  return "Interaction cues appear restrained; motion and hover behavior are not strongly evidenced.";
}

function inferFormSummary(
  derivedSignals: DerivedDesignSignals,
  pricingPaths: string[],
  allPaths: string[],
  metrics: {
    formRichness: number;
    labeledFieldRatio: number;
    fieldRadiusMedian: number;
    fieldStyle: string;
  },
): string {
  if (metrics.formRichness >= 4) {
    return `Forms are materially present with ${metrics.fieldStyle} fields, ${(metrics.labeledFieldRatio * 100).toFixed(0)}% label coverage, and ${Math.round(metrics.fieldRadiusMedian)}px median radius.`;
  }
  if (pricingPaths.length > 0) {
    return `Input and conversion flows appear adjacent to ${derivedSignals.reproduction.commerce.pricingPresence} pricing or product-detail surfaces.`;
  }
  if (allPaths.length > 0) {
    return "The analyzed page exposes limited direct input UI; form behavior cannot be strongly inferred from this reference alone.";
  }
  return "No usable form or input evidence was detected.";
}

function inferResponsiveSummary(input: {
  desktopWidth: number;
  mobileNavCount: number;
  mobileMenuTriggers: number;
  mobileMultiColumnCount: number;
  mobileActionCount: number;
}): string {
  if (input.mobileMenuTriggers >= 1 && input.mobileNavCount <= 4) {
    return `Responsive behavior strongly suggests a collapsed mobile navigation pattern below the ${input.desktopWidth}px desktop layout.`;
  }
  if (input.mobileMultiColumnCount <= 1) {
    return `Responsive behavior suggests content stacks into primarily single-column mobile sections beneath the ${input.desktopWidth}px desktop layout.`;
  }
  return `Responsive behavior appears adaptive, but the page still retains some multi-column structures on mobile beneath the ${input.desktopWidth}px desktop layout.`;
}

function describeImagerySummary(input: {
  dominantMedia: number;
  avgIconCount: number;
  avgPhotoLikeCount: number;
  avgIllustrationCount: number;
  avgVideoCount: number;
}): string {
  if (input.avgPhotoLikeCount >= 6 || input.dominantMedia >= 1.5) {
    return "Photography or product imagery dominates key moments and carries the page narrative.";
  }
  if (input.avgIllustrationCount >= 4 && input.avgPhotoLikeCount < 3) {
    return "Illustration-like graphics and icons play a stronger role than photography in the page narrative.";
  }
  if (input.avgIconCount >= 8 && input.avgPhotoLikeCount < 4) {
    return "Iconography is dense and repeated, while large imagery stays secondary.";
  }
  if (input.avgVideoCount >= 1) {
    return "Mixed imagery system with video or motion media supporting the narrative.";
  }
  return "Imagery supports the hierarchy without fully overtaking copy.";
}

function describeHeroWeight(heroDominance: number): string {
  if (heroDominance >= 0.65) {
    return "Dominant";
  }
  if (heroDominance >= 0.4) {
    return "Moderate";
  }
  return "Understated";
}

function confidenceFromRatio(numerator: number, denominator: number): Confidence {
  if (denominator <= 0) {
    return "low";
  }
  const ratio = numerator / denominator;
  if (ratio >= 0.8) {
    return "high";
  }
  if (ratio >= 0.45) {
    return "medium";
  }
  return "low";
}

function confidenceRank(confidence: Confidence): number {
  if (confidence === "high") {
    return 3;
  }
  if (confidence === "medium") {
    return 2;
  }
  return 1;
}

function pushMotif(target: SiteMotif[], input: {
  condition: boolean;
  label: string;
  rationale: string;
  evidencePaths: string[];
  strength: "signature" | "supporting";
}): void {
  if (!input.condition || input.evidencePaths.length === 0) {
    return;
  }

  target.push({
    label: input.label,
    rationale: input.rationale,
    evidencePaths: uniqueStrings(input.evidencePaths).slice(0, 4),
    strength: input.strength,
  });
}

function mostCommon<T>(values: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
