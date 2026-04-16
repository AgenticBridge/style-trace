export type PageSelectionMode = "auto" | "homepage-only";
export type SynthesisMode = "single-site-profile" | "cross-site-commonality";
export type OutputFormat = "json" | "json+markdown";
export type Confidence = "high" | "medium" | "low";
export type BackgroundMode = "light" | "dark" | "mixed";
export type ContrastTendency = "high" | "medium" | "low";
export type Density = "airy" | "balanced" | "dense";
export type NavDensity = "minimal" | "expanded";
export type HeaderCtaPattern = "none" | "single-primary" | "multiple-primary";
export type HeroCtaPattern = "none" | "single-primary" | "dual-cta" | "repeated";
export type ButtonRadius = "sharp" | "soft" | "pill";
export type ButtonEmphasis = "subtle" | "mixed" | "solid";
export type ButtonSize = "compact" | "comfortable" | "large";
export type PricingPresence = "none" | "section" | "page" | "section+page";
export type ProofPresence = "none" | "supporting" | "prominent";
export type PageIntent = "home" | "pricing" | "product" | "company" | "proof" | "other";
export type HeroMediaStyle = "text-only" | "split-media" | "immersive-media";
export type CardStyle = "none" | "editorial-panels" | "product-grid" | "comparison-cards" | "mixed-cards";
export type PricingBlockStyle = "none" | "single-offer" | "tier-cards" | "comparison-table" | "mixed-pricing";
export type ProofStyle = "none" | "logo-band" | "testimonials" | "case-studies" | "mixed-proof";
export type Tone =
  | "minimal"
  | "technical"
  | "enterprise-like"
  | "playful"
  | "premium"
  | "trust-focused"
  | "editorial";

export interface NormalizedInput {
  urls: string[];
  maxPagesPerSite: number;
  pageSelectionMode: PageSelectionMode;
  synthesisMode: SynthesisMode;
  outputFormat: OutputFormat;
}

export interface PageSnapshot {
  path: string;
  url: string;
  title: string;
  bodyBackgroundColor: string;
  bodyTextColor: string;
  bodyFontFamily: string;
  bodyFontSize: number;
  pageHeight: number;
  textLength: number;
  navLinkTexts: string[];
  footerLinkTexts: string[];
  internalLinks: Array<{
    href: string;
    text: string;
    region: "header" | "nav" | "main" | "footer" | "other";
  }>;
  headings: Array<{
    tagName: string;
    text: string;
    top: number;
    fontSize: number;
    fontWeight: number;
    fontFamily: string;
  }>;
  actions: Array<{
    tagName: string;
    text: string;
    top: number;
    region: "header" | "nav" | "main" | "footer" | "other";
    backgroundColor: string;
    textColor: string;
    borderColor: string;
    borderRadius: number;
    fontWeight: number;
    paddingX: number;
    paddingY: number;
  }>;
  sectionHints: Array<{
    label: string;
    top: number;
  }>;
  sectionCandidates: Array<{
    top: number;
    height: number;
    headingText: string;
    headingTag: string;
    headingSize: number;
    headingCount: number;
    actionCount: number;
    primaryActionCount: number;
    cardCount: number;
    logoLikeCount: number;
    mediaCount: number;
    largeMediaCount: number;
    textLength: number;
    labels: string[];
  }>;
  widthSamples: number[];
}

export interface PageSignals {
  path: string;
  sections: string[];
  intent: PageIntent;
  primaryCtaPattern: HeroCtaPattern;
}

export interface SiteStyleProfile {
  tone: Tone[];
  colors: {
    backgroundMode: BackgroundMode;
    accentCount: number;
    contrast: ContrastTendency;
    paletteRestraint: "restrained" | "moderate" | "varied";
  };
  typography: {
    headingStyle: string;
    bodyStyle: string;
    scale: string;
    families: string[];
  };
  layout: {
    density: Density;
    sectionRhythm: string;
    structure: string[];
    contentWidth: string;
  };
  components: {
    nav: string;
    buttons: string;
    ctaPresence: string;
    cards: string;
    pricingBlocks: string;
    proof: string;
    footer: string;
  };
  reproduction: {
    header: {
      navDensity: NavDensity;
      ctaPattern: HeaderCtaPattern;
    };
    hero: {
      headingScale: "compact" | "moderate" | "large";
      ctaPattern: HeroCtaPattern;
      mediaStyle: HeroMediaStyle;
      proofNearTop: boolean;
    };
    buttons: {
      radius: ButtonRadius;
      emphasis: ButtonEmphasis;
      size: ButtonSize;
    };
    commerce: {
      pricingPresence: PricingPresence;
      proofPresence: ProofPresence;
    };
  };
}

export interface SiteProfile {
  url: string;
  pagesAnalyzed: string[];
  styleProfile: SiteStyleProfile;
  evidence: {
    analyzedPageCount: number;
    pageSignals: PageSignals[];
    reproductionBasis: {
      headerNavLinkCount: number;
      headerPrimaryCtaCount: number;
      headerActionCount: number;
      heroPaths: string[];
      heroPrimaryCtaCount: number;
      heroHeadingMaxSize: number;
      heroMediaPaths: string[];
      cardPaths: string[];
      pricingPaths: string[];
      proofPaths: string[];
    };
  };
}

export interface GuidelineRule {
  rule: string;
  confidence: Confidence;
  evidenceCount: number;
}

export interface StyleTraceResult {
  [key: string]: unknown;
  sites: SiteProfile[];
  observedCommonalities: {
    visualTone: string[];
    layoutPatterns: string[];
    componentPatterns: string[];
  };
  guideline: {
    mode: "unopinionated-synthesis";
    rules: GuidelineRule[];
    avoid: Array<{
      rule: string;
      reason: string;
    }>;
  };
  markdownSummary?: string;
}
