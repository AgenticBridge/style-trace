import test from "node:test";
import assert from "node:assert/strict";
import { buildImageReferenceProfile, type ImageStats } from "../src/analysis/imageReferenceAnalysis.js";
import type { CapturedPage } from "../src/core/types.js";

const capturedPage: CapturedPage = {
  path: "/image-reference",
  intent: "other",
  heroCtaPattern: "none",
  viewport: { width: 1200, height: 800 },
  moduleSequence: ["hero"],
  modules: [
    {
      kind: "hero",
      top: 0,
      height: 800,
      emphasis: "high",
      heading: "Image reference",
      evidenceLabels: ["image-reference"],
      hasPrimaryAction: false,
      mediaWeight: "dominant",
      cardDensity: "none",
      visualProfile: {
        alignment: "centered",
        balance: "media-led",
        surfaceStyle: "flat",
        whitespace: "open",
        backgroundMode: "mixed",
        viewportCoverage: 1,
      },
    },
  ],
  visualSignals: {
    heroDominance: 1,
    chromeVisibility: "low",
    visualRhythm: "editorial",
  },
  visualCaptures: [
    {
      kind: "hero",
      label: "Image crop",
      moduleKind: "hero",
      path: "/tmp/image-crop.png",
      clip: { x: 0, y: 0, width: 1200, height: 800 },
    },
  ],
};

const stats: ImageStats = {
  aspectRatio: 1.5,
  averageLightness: 0.42,
  averageSaturation: 0.31,
  darkRatio: 0.61,
  lightRatio: 0.08,
  vividRatio: 0.24,
  whitespaceRatio: 0.18,
  edgeDensity: 0.22,
  paletteBucketCount: 14,
};

test("buildImageReferenceProfile emits image-specific grammar with constrained confidence", () => {
  const result = buildImageReferenceProfile("https://cdn.example.com/reference/hero-shot.png", stats, capturedPage);

  assert.equal(result.sourceType, "image");
  assert.deepEqual(result.pagesAnalyzed, ["/image-reference"]);
  assert.equal(result.pageEvidence?.[0]?.heroCtaPattern, "none");
  assert.equal(result.capturedPages[0]?.modules[0]?.mediaWeight, "dominant");
  assert.equal(result.designGrammar.colorArchitecture.confidence, "high");
  assert.equal(result.designGrammar.iconographyAndImagery.confidence, "high");
  assert.equal(result.designGrammar.typographyScale.confidence, "low");
  assert.equal(result.designGrammar.navigationLogic.confidence, "low");
  assert.equal(result.designGrammar.formAndInputDesign.confidence, "low");
  assert.match(result.designGrammar.colorArchitecture.summary, /restrained|dark|palette/i);
  assert.match(result.designGrammar.iconographyAndImagery.summary, /imagery|detail|color-led|restrained/i);
  assert.ok(result.designGrammar.signatureMotifs.some((motif) => motif.label.includes("palette")));
  assert.ok(result.designGrammar.reconstructionDirectives.some((directive) => directive.includes("do not over-infer") || directive.includes("Preserve")));
});
