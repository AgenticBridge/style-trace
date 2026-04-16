import test from "node:test";
import assert from "node:assert/strict";
import { synthesizeResult } from "../src/synthesis.js";
import type { SiteProfile } from "../src/types.js";

const siteA: SiteProfile = {
  url: "https://alpha.example",
  pagesAnalyzed: ["/"],
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
    analyzedPageCount: 1,
    pageSignals: [{ path: "/", sections: ["hero", "proof", "features", "cta"], intent: "home", primaryCtaPattern: "single-primary" }],
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
};

const siteB: SiteProfile = {
  url: "https://beta.example",
  pagesAnalyzed: ["/"],
  styleProfile: {
    tone: ["playful"],
    colors: {
      backgroundMode: "dark",
      accentCount: 3,
      contrast: "medium",
      paletteRestraint: "varied",
    },
    typography: {
      headingStyle: "medium serif",
      bodyStyle: "neutral serif",
      scale: "compact heading scale",
      families: ["serif"],
    },
    layout: {
      density: "dense",
      sectionRhythm: "tight vertical spacing",
      structure: ["hero", "pricing"],
      contentWidth: "compact content container",
    },
    components: {
      nav: "expanded top nav with multiple primary CTAs",
      buttons: "square-to-soft, mixed emphasis",
      ctaPresence: "CTA present but visually restrained",
      cards: "mixed supporting cards",
      pricingBlocks: "single-offer pricing panels",
      proof: "no explicit proof modules",
      footer: "multi-column footer with utility links",
    },
    reproduction: {
      header: {
        navDensity: "expanded",
        ctaPattern: "multiple-primary",
      },
      hero: {
        headingScale: "compact",
        ctaPattern: "none",
        mediaStyle: "text-only",
        proofNearTop: false,
      },
      buttons: {
        radius: "sharp",
        emphasis: "subtle",
        size: "compact",
      },
      commerce: {
        pricingPresence: "page",
        proofPresence: "none",
      },
    },
  },
  evidence: {
    analyzedPageCount: 1,
    pageSignals: [{ path: "/", sections: ["hero", "pricing"], intent: "pricing", primaryCtaPattern: "none" }],
    reproductionBasis: {
      headerNavLinkCount: 8,
      headerPrimaryCtaCount: 0,
      headerActionCount: 3,
      heroPaths: ["/"],
      heroPrimaryCtaCount: 0,
      heroHeadingMaxSize: 40,
      heroMediaPaths: [],
      cardPaths: ["/pricing"],
      pricingPaths: ["/pricing"],
      proofPaths: [],
    },
  },
};

test("synthesizeResult uses cross-site overlap in cross-site mode", () => {
  const result = synthesizeResult([siteA, siteB], "cross-site-commonality");

  assert.deepEqual(result.observedCommonalities.visualTone, []);
  assert.deepEqual(result.observedCommonalities.layoutPatterns, ["hero"]);
});

test("synthesizeResult honors single-site mode when multiple sites are provided", () => {
  const result = synthesizeResult([siteA, siteB], "single-site-profile");

  assert.deepEqual(result.observedCommonalities.visualTone, ["minimal", "technical"]);
  assert.deepEqual(result.observedCommonalities.layoutPatterns, ["hero", "proof", "features", "cta"]);
  assert.match(result.guideline.rules[0]?.rule ?? "", /Use one accent color only/);
  assert.equal(result.guideline.rules[0]?.evidenceCount, 1);
});
