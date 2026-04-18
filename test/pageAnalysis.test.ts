import test from "node:test";
import assert from "node:assert/strict";
import { buildSiteStyleProfile } from "../src/pageAnalysis.js";
import type { PageSnapshot } from "../src/types.js";

const snapshot: PageSnapshot = {
  path: "/",
  url: "https://example.com/",
  title: "Example pricing and proof",
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
    { top: 80, height: 720, headingText: "Build faster", headingTag: "h1", headingSize: 64, headingCount: 2, actionCount: 2, primaryActionCount: 2, cardCount: 1, logoLikeCount: 0, mediaCount: 1, largeMediaCount: 1, textLength: 220, labels: ["hero", "cta"] },
    { top: 900, height: 420, headingText: "Trusted by teams", headingTag: "h2", headingSize: 36, headingCount: 3, actionCount: 0, primaryActionCount: 0, cardCount: 6, logoLikeCount: 4, mediaCount: 3, largeMediaCount: 0, textLength: 260, labels: ["proof"] },
    { top: 1700, height: 640, headingText: "Plans", headingTag: "h2", headingSize: 34, headingCount: 4, actionCount: 3, primaryActionCount: 1, cardCount: 4, logoLikeCount: 0, mediaCount: 2, largeMediaCount: 1, textLength: 340, labels: ["pricing", "features", "cta"] },
  ],
  widthSamples: [960, 980, 1000],
};

test("buildSiteStyleProfile emits compact provenance for reproduction cues", () => {
  const result = buildSiteStyleProfile([snapshot]);

  assert.deepEqual(result.pageEvidence[0]?.sectionOrder, ["hero", "cta", "proof", "pricing"]);
  assert.equal(result.pageEvidence[0]?.intent, "home");
  assert.equal(result.pageEvidence[0]?.heroCtaPattern, "dual-cta");
  assert.equal(result.styleProfile.reproduction.hero.ctaPattern, "dual-cta");
  assert.equal(result.styleProfile.reproduction.hero.mediaStyle, "immersive-media");
  assert.equal(result.styleProfile.reproduction.hero.proofNearTop, true);
  assert.equal(result.styleProfile.reproduction.commerce.pricingPresence, "section+page");
  assert.match(result.styleProfile.components.cards, /pricing|cards|proof/i);
  assert.match(result.styleProfile.components.proof, /proof|testimonial|logo/i);
});
