import test from "node:test";
import assert from "node:assert/strict";
import { synthesizeResult } from "../src/analysis/synthesis.js";
import { compareArtifactAgainstStyle } from "../src/analysis/reviewGeneratedStyle.js";
import type { NormalizedInput, SiteProfile } from "../src/core/types.js";

const synthesisInput: NormalizedInput = {
  references: [{ type: "url", value: "https://alpha.example" }],
  synthesisMode: "single-site-profile",
  evidenceMode: "omit",
  targetArtifact: "landing-page",
  fidelity: "high",
};

const referenceSite: SiteProfile = {
  url: "https://alpha.example",
  sourceType: "url",
  pagesAnalyzed: ["/"],
  pageEvidence: [{ path: "/", sectionOrder: ["hero", "features", "cta"], intent: "home", heroCtaPattern: "single-primary" }],
  capturedPages: [{
    path: "/",
    intent: "home",
    heroCtaPattern: "single-primary",
    viewport: { width: 1440, height: 900 },
    moduleSequence: ["navigation", "hero", "features", "cta", "footer"],
    modules: [
      { kind: "navigation", top: 0, height: 80, emphasis: "low", heading: "Navigation", evidenceLabels: ["navigation"], hasPrimaryAction: true, mediaWeight: "none", cardDensity: "none", visualProfile: { alignment: "split", balance: "copy-led", surfaceStyle: "flat", whitespace: "moderate", backgroundMode: "light", viewportCoverage: 0.08 } },
      { kind: "hero", top: 80, height: 620, emphasis: "high", heading: "Hero", evidenceLabels: ["hero"], hasPrimaryAction: true, mediaWeight: "supporting", cardDensity: "none", visualProfile: { alignment: "split", balance: "balanced", surfaceStyle: "flat", whitespace: "open", backgroundMode: "light", viewportCoverage: 0.58 } },
    ],
    visualSignals: { heroDominance: 0.72, chromeVisibility: "medium", visualRhythm: "editorial" },
    visualCaptures: [],
  }],
  derivedSignals: {
    colors: { backgroundMode: "light", accentCount: 1, contrast: "high", paletteRestraint: "restrained" },
    typography: { headingStyle: "bold sans", bodyStyle: "neutral sans", scale: "large", families: ["Inter"] },
    layout: { density: "airy", sectionRhythm: "editorial cadence", structure: ["hero", "features", "cta"], contentWidth: "standard marketing container" },
    imagery: { iconDensity: "low", photoPresence: "medium", illustrationPresence: "low", videoPresence: "none" },
    motion: { motionLevel: "restrained", stickyLevel: "light", hoverEmphasis: "clear" },
    forms: { fieldStyle: "outlined" },
    components: { nav: "simple top nav", buttons: "soft rounded, solid primary", ctaPresence: "single clear primary CTA per page", footer: "simple footer" },
    reproduction: {
      header: { navDensity: "minimal", ctaPattern: "single-primary" },
      hero: { headingScale: "large", ctaPattern: "single-primary", mediaStyle: "split-media", proofNearTop: false },
      buttons: { radius: "soft", emphasis: "solid", size: "comfortable" },
      commerce: { pricingPresence: "none" },
    },
  },
  designGrammar: {
    model: "ten-aspect-v1",
    visualHierarchy: { summary: "Dominant hero.", observations: [], evidencePaths: ["/"], confidence: "high" },
    typographyScale: { summary: "Large headline.", observations: [], evidencePaths: ["/"], confidence: "high" },
    colorArchitecture: { summary: "Restrained light palette.", observations: [], evidencePaths: ["/"], confidence: "high" },
    gridAndSpacing: { summary: "Editorial spacing.", observations: [], evidencePaths: ["/"], confidence: "high" },
    iconographyAndImagery: { summary: "Split-media hero.", observations: [], evidencePaths: ["/"], confidence: "high" },
    componentStates: { summary: "Soft buttons.", observations: [], evidencePaths: ["/"], confidence: "high" },
    navigationLogic: { summary: "Minimal nav.", observations: [], evidencePaths: ["/"], confidence: "high" },
    microInteractions: { summary: "Restrained motion.", observations: [], evidencePaths: ["/"], confidence: "low" },
    formAndInputDesign: { summary: "Outlined forms.", observations: [], evidencePaths: ["/"], confidence: "medium" },
    responsiveBreakpoints: { summary: "Responsive behavior inferred.", observations: [], evidencePaths: ["/"], confidence: "low" },
    signatureMotifs: [{ label: "open split hero", rationale: "Hero motif", evidencePaths: ["/"], strength: "signature" }],
    reconstructionDirectives: ["Keep split-media hero and restrained palette."],
  },
};

test("compareArtifactAgainstStyle flags drift against prompt-ready invariants", () => {
  const styleResult = synthesizeResult([referenceSite], synthesisInput);
  const generatedArtifact: SiteProfile = {
    ...referenceSite,
    derivedSignals: {
      ...referenceSite.derivedSignals,
      colors: { backgroundMode: "dark", accentCount: 3, contrast: "medium", paletteRestraint: "varied" },
      motion: { motionLevel: "active", stickyLevel: "strong", hoverEmphasis: "strong" },
      reproduction: {
        ...referenceSite.derivedSignals.reproduction,
        header: { navDensity: "expanded", ctaPattern: "multiple-primary" },
        hero: { ...referenceSite.derivedSignals.reproduction.hero, mediaStyle: "immersive-media" },
      },
    },
    capturedPages: [{
      ...referenceSite.capturedPages[0]!,
      visualSignals: { heroDominance: 0.18, chromeVisibility: "high", visualRhythm: "modular" },
      heroCtaPattern: "repeated",
      modules: referenceSite.capturedPages[0]!.modules.map((module) => module.kind === "hero"
        ? { ...module, mediaWeight: "dominant", cardDensity: "heavy", visualProfile: { ...module.visualProfile, whitespace: "tight", backgroundMode: "dark" } }
        : { ...module, cardDensity: "heavy" }),
    }],
    designGrammar: {
      ...referenceSite.designGrammar,
      visualHierarchy: { ...referenceSite.designGrammar.visualHierarchy, confidence: "medium" },
      colorArchitecture: { ...referenceSite.designGrammar.colorArchitecture, summary: "Varied dark palette." },
      navigationLogic: { ...referenceSite.designGrammar.navigationLogic, summary: "Expanded nav." },
      microInteractions: { ...referenceSite.designGrammar.microInteractions, confidence: "high" },
      responsiveBreakpoints: { ...referenceSite.designGrammar.responsiveBreakpoints, confidence: "high" },
    },
  };

  const review = compareArtifactAgainstStyle(styleResult, generatedArtifact, {
    artifactType: "html",
    width: 1440,
    height: 900,
  });

  assert.equal(review.mode, "style-review-v1");
  assert.ok(review.violatedConstraints.some((item) => item.id === "color-architecture"));
  assert.ok(review.violatedConstraints.some((item) => item.id === "generic-template-drift"));
  assert.ok(review.driftNotes.some((item) => /palette restraint drifted/i.test(item)));
  assert.equal(review.artifactType, "html");
});
