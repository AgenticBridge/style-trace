import test from "node:test";
import assert from "node:assert/strict";
import { buildSiteAnalysisResult } from "../src/analysis/pageAnalysis.js";
import type { PageSnapshot } from "../src/core/types.js";

const snapshot: PageSnapshot = {
  path: "/",
  url: "https://example.com/",
  title: "Example pricing and proof",
  viewportWidth: 1440,
  viewportHeight: 900,
  bodyBackgroundColor: "rgb(255, 255, 255)",
  bodyTextColor: "rgb(20, 20, 20)",
  bodyFontFamily: "Inter, sans-serif",
  bodyFontSize: 16,
  pageHeight: 3200,
  textLength: 1400,
  navLinkTexts: ["Products", "Pricing", "Customers", "Docs"],
  footerLinkTexts: ["Privacy", "Terms", "Contact", "Security"],
  internalLinks: [],
  headings: [
    { tagName: "h1", text: "Build faster", top: 120, fontSize: 64, fontWeight: 700, fontFamily: "Inter, sans-serif" },
    { tagName: "h2", text: "Trusted by teams", top: 920, fontSize: 36, fontWeight: 600, fontFamily: "Inter, sans-serif" },
  ],
  actions: [
    { tagName: "a", text: "Start free", top: 260, region: "main", backgroundColor: "rgb(20, 120, 255)", textColor: "rgb(255,255,255)", borderColor: "rgb(20,120,255)", borderRadius: 14, fontWeight: 600, paddingX: 40, paddingY: 14 },
    { tagName: "a", text: "Book demo", top: 320, region: "main", backgroundColor: "rgb(20, 120, 255)", textColor: "rgb(255,255,255)", borderColor: "rgb(20,120,255)", borderRadius: 14, fontWeight: 600, paddingX: 40, paddingY: 14 },
  ],
  sectionHints: [
    { label: "hero", top: 80 },
    { label: "proof", top: 900 },
    { label: "pricing", top: 1700 },
  ],
  sectionCandidates: [
    { top: 80, height: 720, width: 1200, headingText: "Build faster", headingTag: "h1", headingSize: 64, headingCount: 2, actionCount: 2, primaryActionCount: 2, cardCount: 1, logoLikeCount: 0, mediaCount: 1, largeMediaCount: 1, textLength: 220, backgroundColor: "rgb(255,255,255)", textBlockCount: 4, centeredTextCount: 2, leftAlignedTextCount: 1, mediaAreaRatio: 0.42, viewportCoverage: 0.67, labels: ["hero", "cta"] },
    { top: 900, height: 420, width: 1200, headingText: "Trusted by teams", headingTag: "h2", headingSize: 36, headingCount: 3, actionCount: 0, primaryActionCount: 0, cardCount: 6, logoLikeCount: 4, mediaCount: 3, largeMediaCount: 0, textLength: 260, backgroundColor: "rgb(245,245,245)", textBlockCount: 8, centeredTextCount: 1, leftAlignedTextCount: 5, mediaAreaRatio: 0.14, viewportCoverage: 0.39, labels: ["proof"] },
    { top: 1700, height: 640, width: 1200, headingText: "Plans", headingTag: "h2", headingSize: 34, headingCount: 4, actionCount: 3, primaryActionCount: 1, cardCount: 4, logoLikeCount: 0, mediaCount: 2, largeMediaCount: 1, textLength: 340, backgroundColor: "rgb(250,250,250)", textBlockCount: 10, centeredTextCount: 0, leftAlignedTextCount: 8, mediaAreaRatio: 0.18, viewportCoverage: 0.59, labels: ["pricing", "features", "cta"] },
  ],
  widthSamples: [960, 980, 1000],
  imagerySignals: {
    iconCount: 6,
    photoLikeMediaCount: 3,
    videoCount: 0,
    illustrationLikeCount: 1,
  },
  interactionSignals: {
    animatedElementCount: 2,
    transitionElementCount: 6,
    stickyElementCount: 1,
    hoverableActionCount: 3,
  },
  formSignals: {
    formCount: 1,
    inputCount: 3,
    textareaCount: 0,
    selectCount: 0,
    labeledFieldCount: 3,
    requiredFieldCount: 1,
    fieldRadiusMedian: 12,
    fieldStyle: "outlined",
  },
  responsiveProbe: {
    mobileViewportWidth: 390,
    mobileNavLinkCount: 3,
    mobilePrimaryActionCount: 1,
    mobileMenuTriggerCount: 1,
    mobileMultiColumnSectionCount: 0,
    navCollapseRatio: 0.38,
  },
};

test("buildSiteAnalysisResult emits ten-aspect grammar with reconstruction signals", () => {
  const result = buildSiteAnalysisResult([snapshot]);

  assert.deepEqual(result.pageEvidence[0]?.sectionOrder, ["hero", "cta", "proof", "pricing"]);
  assert.equal(result.pageEvidence[0]?.intent, "home");
  assert.equal(result.pageEvidence[0]?.heroCtaPattern, "dual-cta");
  assert.equal(result.capturedPages[0]?.viewport.width, 1440);
  assert.equal(result.capturedPages[0]?.modules[0]?.visualProfile.balance, "copy-led");
  assert.equal(result.capturedPages[0]?.visualSignals.chromeVisibility, "medium");
  assert.equal(result.designGrammar.model, "ten-aspect-v1");
  assert.match(result.designGrammar.visualHierarchy.summary, /hierarchy|hero/i);
  assert.match(result.designGrammar.colorArchitecture.summary, /color|palette|contrast/i);
  assert.match(result.designGrammar.gridAndSpacing.summary, /spacing|density|container/i);
  assert.match(result.designGrammar.iconographyAndImagery.summary, /imagery|photo|icon|graphics/i);
  assert.match(result.designGrammar.formAndInputDesign.summary, /form|input|pricing|fields/i);
  assert.match(result.designGrammar.responsiveBreakpoints.summary, /Responsive|mobile|layout/i);
  assert.ok(result.designGrammar.signatureMotifs.some((motif) => motif.evidencePaths?.includes("/")));
  assert.ok(result.designGrammar.reconstructionDirectives.length > 0);
});

test("buildSiteAnalysisResult falls back to title-driven sections and pricing intent", () => {
  const pricingSnapshot: PageSnapshot = {
    ...snapshot,
    path: "/pricing",
    url: "https://example.com/pricing",
    title: "Pricing plans for teams",
    navLinkTexts: ["Products", "Pricing", "Enterprise", "Contact sales", "Docs", "Resources"],
    headings: [
      { tagName: "h1", text: "Simple pricing", top: 110, fontSize: 48, fontWeight: 700, fontFamily: "Inter, sans-serif" },
    ],
    actions: [
      { tagName: "a", text: "Contact sales", top: 250, region: "header", backgroundColor: "rgb(20, 120, 255)", textColor: "rgb(255,255,255)", borderColor: "rgb(20,120,255)", borderRadius: 12, fontWeight: 600, paddingX: 36, paddingY: 12 },
    ],
    sectionHints: [],
    sectionCandidates: [],
    imagerySignals: {
      iconCount: 1,
      photoLikeMediaCount: 0,
      videoCount: 0,
      illustrationLikeCount: 0,
    },
    formSignals: {
      formCount: 0,
      inputCount: 0,
      textareaCount: 0,
      selectCount: 0,
      labeledFieldCount: 0,
      requiredFieldCount: 0,
      fieldRadiusMedian: 0,
      fieldStyle: "none",
    },
  };

  const result = buildSiteAnalysisResult([snapshot, pricingSnapshot]);

  assert.deepEqual(result.pageEvidence[1]?.sectionOrder, ["hero", "pricing", "cta"]);
  assert.equal(result.pageEvidence[1]?.intent, "pricing");
  assert.equal(result.pageEvidence[1]?.heroCtaPattern, "single-primary");
  assert.match(result.designGrammar.formAndInputDesign.summary, /pricing|input|form/i);
});
