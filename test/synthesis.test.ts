import test from "node:test";
import assert from "node:assert/strict";
import { synthesizeResult } from "../src/analysis/synthesis.js";
import type { SiteProfile } from "../src/core/types.js";

const siteA: SiteProfile = {
  url: "https://alpha.example",
  pagesAnalyzed: ["/"],
  pageEvidence: [{ path: "/", sectionOrder: ["hero", "proof", "features", "cta"], intent: "home", heroCtaPattern: "single-primary" }],
  capturedPages: [{
    path: "/",
    intent: "home",
    heroCtaPattern: "single-primary",
    viewport: { width: 1440, height: 900 },
    moduleSequence: ["navigation", "hero", "proof", "features", "cta", "footer"],
    modules: [
      { kind: "navigation", top: 0, height: 88, emphasis: "low", heading: "Site navigation", evidenceLabels: ["navigation"], hasPrimaryAction: true, mediaWeight: "none", cardDensity: "none", visualProfile: { alignment: "split", balance: "copy-led", surfaceStyle: "flat", whitespace: "moderate", backgroundMode: "light", viewportCoverage: 0.08 } },
      { kind: "hero", top: 80, height: 620, emphasis: "high", heading: "Build faster", evidenceLabels: ["hero"], hasPrimaryAction: true, mediaWeight: "supporting", cardDensity: "none", visualProfile: { alignment: "split", balance: "balanced", surfaceStyle: "flat", whitespace: "open", backgroundMode: "light", viewportCoverage: 0.58 } },
    ],
    visualSignals: {
      heroDominance: 0.73,
      chromeVisibility: "medium",
      visualRhythm: "editorial",
    },
    visualCaptures: [],
  }],
  designGrammar: {
    model: "ten-aspect-v1",
    visualHierarchy: { summary: "Dominant first-screen hierarchy with split hero composition.", observations: ["Hero balance is balanced."], evidencePaths: ["/"], confidence: "high" },
    typographyScale: { summary: "Large headline system over standard body copy.", observations: ["Heading style: bold sans."], evidencePaths: ["/"], confidence: "high" },
    colorArchitecture: { summary: "Restrained color system with high contrast on light surfaces.", observations: ["1 accent bucket recurs."], evidencePaths: ["/"], confidence: "high" },
    gridAndSpacing: { summary: "Standard marketing container with large vertical spacing and airy density.", observations: ["Module sequence begins hero -> proof -> features -> cta."], evidencePaths: ["/"], confidence: "high" },
    iconographyAndImagery: { summary: "Imagery supports the hierarchy without fully overtaking copy.", observations: ["Hero media style: split-media."], evidencePaths: ["/"], confidence: "medium" },
    componentStates: { summary: "Rounded medium, solid primary; CTAs are single clear primary CTA per page.", observations: ["Button radius trends soft."], evidencePaths: ["/"], confidence: "high" },
    navigationLogic: { summary: "Simple top nav with single primary CTA with medium visual chrome visibility.", observations: ["Navigation density: minimal."], evidencePaths: ["/"], confidence: "high" },
    microInteractions: { summary: "Interaction cues suggest strong primary-action emphasis with limited secondary motion inference.", observations: ["Signals are inferred rather than directly measured."], evidencePaths: ["/"], confidence: "low" },
    formAndInputDesign: { summary: "Input and conversion flows appear adjacent to section+page pricing or product-detail surfaces.", observations: ["Direct form signals are sparse."], evidencePaths: ["/"], confidence: "medium" },
    responsiveBreakpoints: { summary: "Breakpoint behavior is inferred from desktop capture width and container structure, not measured across multiple viewport runs yet.", observations: ["Primary viewport analyzed at 1440px wide."], evidencePaths: ["/"], confidence: "low" },
    signatureMotifs: [
      {
        label: "large headline with staged split-media hero",
        rationale: "Hero treatment trends toward split-media with large headline scale.",
        evidencePaths: ["/"],
        strength: "signature",
      },
    ],
    reconstructionDirectives: [
      "Keep the hero split-media and large instead of replacing it with a generic split layout.",
    ],
  },
};

const siteB: SiteProfile = {
  url: "https://beta.example",
  pagesAnalyzed: ["/"],
  pageEvidence: [{ path: "/", sectionOrder: ["hero", "pricing"], intent: "pricing", heroCtaPattern: "none" }],
  capturedPages: [{
    path: "/",
    intent: "pricing",
    heroCtaPattern: "none",
    viewport: { width: 1440, height: 900 },
    moduleSequence: ["navigation", "hero", "pricing", "footer"],
    modules: [
      { kind: "navigation", top: 0, height: 88, emphasis: "medium", heading: "Site navigation", evidenceLabels: ["navigation"], hasPrimaryAction: true, mediaWeight: "none", cardDensity: "none", visualProfile: { alignment: "split", balance: "copy-led", surfaceStyle: "flat", whitespace: "tight", backgroundMode: "dark", viewportCoverage: 0.08 } },
      { kind: "hero", top: 60, height: 340, emphasis: "medium", heading: "Pricing first", evidenceLabels: ["hero"], hasPrimaryAction: false, mediaWeight: "none", cardDensity: "none", visualProfile: { alignment: "left-led", balance: "copy-led", surfaceStyle: "panel", whitespace: "tight", backgroundMode: "dark", viewportCoverage: 0.31 } },
    ],
    visualSignals: {
      heroDominance: 0.31,
      chromeVisibility: "high",
      visualRhythm: "commerce",
    },
    visualCaptures: [],
  }],
  designGrammar: {
    model: "ten-aspect-v1",
    visualHierarchy: { summary: "Understated first-screen hierarchy with left-led hero composition.", observations: ["Hero balance resolves as copy-led."], evidencePaths: ["/"], confidence: "high" },
    typographyScale: { summary: "Compact headline system over compact body styling.", observations: ["Heading style: medium serif."], evidencePaths: ["/"], confidence: "high" },
    colorArchitecture: { summary: "Varied color system with medium contrast on dark surfaces.", observations: ["3 accent buckets recur."], evidencePaths: ["/"], confidence: "high" },
    gridAndSpacing: { summary: "Compact content container with tight vertical spacing and dense density.", observations: ["Module sequence begins hero -> pricing."], evidencePaths: ["/"], confidence: "high" },
    iconographyAndImagery: { summary: "Imagery is restrained and secondary to copy.", observations: ["Hero media style: text-only."], evidencePaths: ["/"], confidence: "medium" },
    componentStates: { summary: "Square-to-soft, mixed emphasis; CTAs are visually restrained.", observations: ["Button radius trends sharp."], evidencePaths: ["/"], confidence: "high" },
    navigationLogic: { summary: "Expanded top nav with multiple primary CTAs with high visual chrome visibility.", observations: ["Navigation density: expanded."], evidencePaths: ["/"], confidence: "high" },
    microInteractions: { summary: "Interaction cues appear restrained; motion and hover behavior are not strongly evidenced.", observations: ["Signals are inferred rather than directly measured."], evidencePaths: ["/"], confidence: "low" },
    formAndInputDesign: { summary: "Input and conversion flows appear adjacent to page pricing or product-detail surfaces.", observations: ["Direct form signals are sparse."], evidencePaths: ["/"], confidence: "medium" },
    responsiveBreakpoints: { summary: "Breakpoint behavior is inferred from desktop capture width and container structure, not measured across multiple viewport runs yet.", observations: ["Primary viewport analyzed at 1440px wide."], evidencePaths: ["/"], confidence: "low" },
    signatureMotifs: [
      {
        label: "pricing resolved on product-detail pages",
        rationale: "Commerce evidence shows page pricing with single-offer pricing panels.",
        evidencePaths: ["/"],
        strength: "signature",
      },
    ],
    reconstructionDirectives: [
      "Preserve the broader nav system instead of collapsing it into a minimalist shell.",
    ],
  },
};

test("synthesizeResult preserves distinctive signatures in cross-site mode", () => {
  const result = synthesizeResult([siteA, siteB], "cross-site-commonality");

  assert.equal(result.synthesis.mode, "aspect-grammar");
  assert.equal(result.synthesis.referenceSignatures.length, 2);
  assert.equal(result.synthesis.referenceSignatures[0]?.siteUrl, "https://alpha.example");
  assert.ok((result.synthesis.referenceSignatures[0]?.strongestAspects.length ?? 0) > 0);
  assert.match(result.synthesis.referenceSignatures[0]?.motifs[0] ?? "", /hero/i);
  assert.match(result.guideline.rules[0]?.rule ?? "", /visual hierarchy|color architecture|navigation logic/i);
  assert.ok(!result.synthesis.sharedPatterns.some((pattern) => pattern.aspect === "microInteractions"));
  assert.ok(!result.synthesis.sharedPatterns.some((pattern) => pattern.aspect === "responsiveBreakpoints"));
});

test("synthesizeResult honors single-site mode by centering one reference grammar", () => {
  const result = synthesizeResult([siteA, siteB], "single-site-profile");

  assert.equal(result.synthesis.referenceSignatures.length, 1);
  assert.equal(result.synthesis.referenceSignatures[0]?.siteUrl, "https://alpha.example");
  assert.match(result.synthesis.blendStrategy.headline, /lead reference|Preserve the lead reference/i);
  assert.ok(result.synthesis.blendStrategy.directives.some((directive) => directive.includes("visualHierarchy") || directive.includes("split-media") || directive.includes("Large headline")));
});
