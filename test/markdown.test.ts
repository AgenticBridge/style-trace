import test from "node:test";
import assert from "node:assert/strict";
import { renderMarkdownSummary } from "../src/markdown.js";
import type { StyleTraceResult } from "../src/types.js";

test("renderMarkdownSummary includes the key evidence sections", () => {
  const result: StyleTraceResult = {
    sites: [
      {
        url: "https://example.com",
        pagesAnalyzed: ["/", "/pricing"],
        styleProfile: {
          tone: ["minimal", "technical"],
          colors: {
            backgroundMode: "light",
            accentCount: 1,
            contrast: "high",
            paletteRestraint: "restrained",
          },
          typography: {
            headingStyle: "bold sans",
            bodyStyle: "neutral sans",
            scale: "large hero, standard body",
            families: ["sans"],
          },
          layout: {
            density: "airy",
            sectionRhythm: "large vertical spacing",
            structure: ["hero", "proof", "features", "cta"],
            contentWidth: "standard marketing container",
          },
          components: {
            nav: "simple top nav with single primary CTA",
            buttons: "rounded medium, solid primary",
            ctaPresence: "single clear primary CTA per page",
            cards: "comparison-style pricing cards",
            pricingBlocks: "tiered pricing cards",
            proof: "mixed logo proof and testimonial/case-study modules",
            footer: "compact footer with essential links",
          },
          reproduction: {
            header: {
              navDensity: "minimal",
              ctaPattern: "single-primary",
            },
            hero: {
              headingScale: "large",
              ctaPattern: "single-primary",
              mediaStyle: "split-media",
              proofNearTop: true,
            },
            buttons: {
              radius: "soft",
              emphasis: "solid",
              size: "comfortable",
            },
            commerce: {
              pricingPresence: "section+page",
              proofPresence: "prominent",
            },
          },
        },
        evidence: {
          analyzedPageCount: 2,
          pageSignals: [
            { path: "/", sections: ["hero", "proof", "features", "cta"], intent: "home", primaryCtaPattern: "single-primary" },
          ],
          reproductionBasis: {
            headerNavLinkCount: 4,
            headerPrimaryCtaCount: 1,
            headerActionCount: 2,
            heroPaths: ["/"],
            heroPrimaryCtaCount: 1,
            heroHeadingMaxSize: 64,
            heroMediaPaths: ["/"],
            cardPaths: ["/pricing"],
            pricingPaths: ["/pricing"],
            proofPaths: ["/customers"],
          },
        },
      },
    ],
    observedCommonalities: {
      visualTone: ["minimal", "technical"],
      layoutPatterns: ["hero", "proof", "features", "cta"],
      componentPatterns: ["simple top nav with single primary CTA"],
    },
    guideline: {
      mode: "unopinionated-synthesis",
      rules: [
        { rule: "Use one accent color only", confidence: "high", evidenceCount: 1 },
      ],
      avoid: [
        {
          rule: "Do not introduce unsupported visual treatments.",
          reason: "StyleTrace only preserves repeated patterns with direct evidence.",
        },
      ],
    },
  };

  const markdown = renderMarkdownSummary(result);
  assert.match(markdown, /StyleTrace summary/);
  assert.match(markdown, /Shared visual tone/);
  assert.match(markdown, /reproduction cues/);
  assert.match(markdown, /Use one accent color only/);
  assert.match(markdown, /Unsupported patterns to avoid/);
});
