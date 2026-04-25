export type SynthesisMode = "single-site-profile" | "cross-site-commonality";
export type EvidenceMode = "omit" | "file" | "inline";
export type ReferenceType = "url" | "image" | "screenshot" | "html";
export type Confidence = "high" | "medium" | "low";
export type TargetArtifact = "landing-page" | "product-ui" | "slide-deck" | "prototype" | "comparison-board" | "other";
export type Fidelity = "low" | "medium" | "high";
export type DesignAspectKey =
  | "visualHierarchy"
  | "typographyScale"
  | "colorArchitecture"
  | "gridAndSpacing"
  | "iconographyAndImagery"
  | "componentStates"
  | "navigationLogic"
  | "microInteractions"
  | "formAndInputDesign"
  | "responsiveBreakpoints";
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
export type PageIntent = "home" | "pricing" | "product" | "company" | "proof" | "other";
export type HeroMediaStyle = "text-only" | "split-media" | "immersive-media";
export type MotifStrength = "signature" | "supporting";
export type ModuleKind = "hero" | "features" | "pricing" | "proof" | "cta" | "comparison" | "promo" | "navigation" | "footer" | "content";
export type VisualAlignment = "left-led" | "centered" | "split" | "mixed";
export type VisualBalance = "copy-led" | "balanced" | "media-led";
export type SurfaceStyle = "flat" | "panel" | "mixed";
export type Whitespace = "tight" | "moderate" | "open";
export interface NormalizedInput {
  references: Array<{
    type: ReferenceType;
    value: string;
  }>;
  synthesisMode: SynthesisMode;
  evidenceMode: EvidenceMode;
  targetArtifact: TargetArtifact;
  fidelity: Fidelity;
  designIntent?: string;
}

export interface PageSnapshot {
  path: string;
  url: string;
  title: string;
  viewportWidth: number;
  viewportHeight: number;
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
    width: number;
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
    backgroundColor: string;
    textBlockCount: number;
    centeredTextCount: number;
    leftAlignedTextCount: number;
    mediaAreaRatio: number;
    viewportCoverage: number;
    labels: string[];
  }>;
  widthSamples: number[];
  imagerySignals: {
    iconCount: number;
    photoLikeMediaCount: number;
    videoCount: number;
    illustrationLikeCount: number;
  };
  interactionSignals: {
    animatedElementCount: number;
    transitionElementCount: number;
    stickyElementCount: number;
    hoverableActionCount: number;
  };
  formSignals: {
    formCount: number;
    inputCount: number;
    textareaCount: number;
    selectCount: number;
    labeledFieldCount: number;
    requiredFieldCount: number;
    fieldRadiusMedian: number;
    fieldStyle: "filled" | "outlined" | "mixed" | "none";
  };
  responsiveProbe: {
    mobileViewportWidth: number;
    mobileNavLinkCount: number;
    mobilePrimaryActionCount: number;
    mobileMenuTriggerCount: number;
    mobileMultiColumnSectionCount: number;
    navCollapseRatio: number;
  };
}

export interface PageEvidence {
  path: string;
  sectionOrder: string[];
  intent: PageIntent;
  heroCtaPattern: HeroCtaPattern;
}

export interface VisualModule {
  kind: ModuleKind;
  top: number;
  height: number;
  emphasis: "low" | "medium" | "high";
  heading: string;
  evidenceLabels: string[];
  hasPrimaryAction: boolean;
  mediaWeight: "none" | "supporting" | "dominant";
  cardDensity: "none" | "light" | "heavy";
  visualProfile: {
    alignment: VisualAlignment;
    balance: VisualBalance;
    surfaceStyle: SurfaceStyle;
    whitespace: Whitespace;
    backgroundMode: BackgroundMode;
    viewportCoverage: number;
  };
}

export interface VisualCapture {
  kind: "full-page" | "hero" | "section";
  label: string;
  moduleKind?: ModuleKind;
  path: string;
  clip: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface CapturedPage {
  path: string;
  intent: PageIntent;
  heroCtaPattern: HeroCtaPattern;
  viewport: {
    width: number;
    height: number;
  };
  moduleSequence: ModuleKind[];
  modules: VisualModule[];
  visualSignals: {
    heroDominance: number;
    chromeVisibility: "low" | "medium" | "high";
    visualRhythm: "editorial" | "modular" | "commerce";
  };
  visualCaptures?: VisualCapture[];
}

export interface DerivedDesignSignals {
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
  imagery: {
    iconDensity: "low" | "medium" | "high";
    photoPresence: "low" | "medium" | "high";
    illustrationPresence: "low" | "medium" | "high";
    videoPresence: "none" | "present";
  };
  motion: {
    motionLevel: "restrained" | "moderate" | "active";
    stickyLevel: "none" | "light" | "strong";
    hoverEmphasis: "subtle" | "clear" | "strong";
  };
  forms: {
    fieldStyle: PageSnapshot["formSignals"]["fieldStyle"];
  };
  components: {
    nav: string;
    buttons: string;
    ctaPresence: string;
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
    };
  };
}

export interface SiteMotif {
  label: string;
  rationale: string;
  evidencePaths?: string[];
  strength: MotifStrength;
}

export interface DesignAspect {
  summary: string;
  observations: string[];
  evidencePaths?: string[];
  confidence: Confidence;
}

export interface VisualVocabulary {
  typeSystem: {
    headlineScale: string;
    headingStyle: string;
    bodyStyle: string;
    families: string[];
    confidence: Confidence;
  };
  colorSystem: {
    backgroundMode: BackgroundMode;
    contrast: ContrastTendency;
    paletteRestraint: "restrained" | "moderate" | "varied";
    accentCount: number;
  };
  layoutSystem: {
    contentWidth: string;
    sectionRhythm: string;
    density: Density;
    moduleRhythm: CapturedPage["visualSignals"]["visualRhythm"];
  };
  componentSystem: {
    navDensity: NavDensity;
    headerCtaPattern: HeaderCtaPattern;
    heroCtaPattern: HeroCtaPattern;
    buttonRadius: ButtonRadius;
    buttonEmphasis: ButtonEmphasis;
    cardDensity: VisualModule["cardDensity"];
    formStyle: PageSnapshot["formSignals"]["fieldStyle"];
  };
  imagerySystem: {
    heroMediaStyle: HeroMediaStyle;
    mediaWeight: VisualModule["mediaWeight"];
    iconDensity: "low" | "medium" | "high";
    photoPresence: "low" | "medium" | "high";
    illustrationPresence: "low" | "medium" | "high";
    videoPresence: "none" | "present";
  };
  motionSystem: {
    motionLevel: "restrained" | "moderate" | "active";
    stickyLevel: "none" | "light" | "strong";
    hoverEmphasis: "subtle" | "clear" | "strong";
    confidence: Confidence;
  };
}

export interface StyleInvariant {
  id: string;
  rule: string;
  appliesTo: string[];
  strength: "hard" | "soft";
  confidence: Confidence;
  evidenceCount: number;
}

export interface StyleRisk {
  id: string;
  risk: string;
  reason: string;
  severity: "high" | "medium" | "low";
}

export interface SoftGuess {
  id: string;
  area: string;
  guidance: string;
  confidence: Confidence;
}

export interface CompositionBlueprintStep {
  siteUrl: string;
  pagePath: string;
  module: ModuleKind;
  role: string;
  layout: string;
  emphasis: VisualModule["emphasis"];
  mediaRole: VisualModule["mediaWeight"];
  spacing: Whitespace;
  surface: string;
  ctaBehavior: HeroCtaPattern;
  preserve: string[];
  adaptationNotes: string[];
}

export interface VariationAxis {
  axis: "density" | "mediaWeight" | "colorExpression" | "chromeVisibility" | "moduleRhythm" | "ctaPressure";
  options: string[];
  recommended: string;
  rationale: string;
}

export interface BlendMode {
  mode: "lead-reference" | "common-core" | "contrast-set";
  headline: string;
  directives: string[];
}

export interface PromptReadyBrief {
  summary: string;
  targetArtifact: TargetArtifact;
  fidelity: Fidelity;
  designIntent?: string;
  buildPriorities: string[];
  do: string[];
  avoid: string[];
  reviewChecklist: string[];
}

export interface ReviewContract {
  mustMatch: StyleInvariant[];
  mustAvoid: StyleRisk[];
  compareAgainst: string[];
  viewportChecks: string[];
  uncertainAreas: string[];
}

export interface OriginalityBoundary {
  safeToReuse: string[];
  doNotCopy: string[];
  adaptationGuidance: string[];
}

export interface SiteDesignGrammar {
  model: "ten-aspect-v1";
  visualHierarchy: DesignAspect;
  typographyScale: DesignAspect;
  colorArchitecture: DesignAspect;
  gridAndSpacing: DesignAspect;
  iconographyAndImagery: DesignAspect;
  componentStates: DesignAspect;
  navigationLogic: DesignAspect;
  microInteractions: DesignAspect;
  formAndInputDesign: DesignAspect;
  responsiveBreakpoints: DesignAspect;
  signatureMotifs: SiteMotif[];
  reconstructionDirectives: string[];
}

export interface SiteProfile {
  url: string;
  sourceType?: ReferenceType;
  pagesAnalyzed: string[];
  pageEvidence?: PageEvidence[];
  capturedPages: CapturedPage[];
  derivedSignals: DerivedDesignSignals;
  designGrammar: SiteDesignGrammar;
}

export interface PublicSiteProfile {
  url: string;
  sourceType?: ReferenceType;
  pagesAnalyzed: string[];
  pageEvidence?: PageEvidence[];
  capturedPages: CapturedPage[];
  designGrammar: SiteDesignGrammar;
}

export interface GuidelineRule {
  rule: string;
  confidence: Confidence;
  evidenceCount: number;
}

export interface ReferenceSignature {
  siteUrl: string;
  summary: string;
  strongestAspects: DesignAspectKey[];
  motifs: string[];
  evidencePaths?: string[];
}

export interface StyleTraceResult {
  [key: string]: unknown;
  sites: PublicSiteProfile[];
  evidenceArtifactPath?: string;
  visualVocabulary: VisualVocabulary;
  styleInvariants: StyleInvariant[];
  styleRisks: StyleRisk[];
  softGuesses: SoftGuess[];
  compositionBlueprint: CompositionBlueprintStep[];
  variationAxes: VariationAxis[];
  blendModes: BlendMode[];
  promptReadyBrief: PromptReadyBrief;
  reviewContract: ReviewContract;
  originalityBoundary: OriginalityBoundary;
  synthesis: {
    mode: "aspect-grammar";
    sharedPatterns: Array<{
      aspect: DesignAspectKey;
      summary: string;
    }>;
    referenceSignatures: ReferenceSignature[];
    blendStrategy: {
      headline: string;
      directives: string[];
      avoid: string[];
    };
  };
  guideline: {
    mode: "aspect-preserving-synthesis";
    rules: GuidelineRule[];
    avoid: Array<{
      rule: string;
      reason: string;
    }>;
  };
}

export interface InternalStyleTraceResult {
  sites: SiteProfile[];
  evidenceArtifactPath?: string;
  visualVocabulary: VisualVocabulary;
  styleInvariants: StyleInvariant[];
  styleRisks: StyleRisk[];
  softGuesses: SoftGuess[];
  compositionBlueprint: CompositionBlueprintStep[];
  variationAxes: VariationAxis[];
  blendModes: BlendMode[];
  promptReadyBrief: PromptReadyBrief;
  reviewContract: ReviewContract;
  originalityBoundary: OriginalityBoundary;
  synthesis: StyleTraceResult["synthesis"];
  guideline: StyleTraceResult["guideline"];
}

export interface ReviewGeneratedStyleInput {
  styleResult: StyleTraceResult;
  generatedHtml?: string;
  generatedImageUrl?: string;
  viewportWidth?: number;
  viewportHeight?: number;
}

export interface ReviewGeneratedStyleResult {
  [key: string]: unknown;
  mode: "style-review-v1";
  artifactType: "html" | "image";
  viewport: {
    width: number;
    height: number;
  };
  matchedInvariants: Array<{
    id: string;
    rule: string;
    confidence: Confidence;
  }>;
  violatedConstraints: Array<{
    id: string;
    rule: string;
    severity: "high" | "medium" | "low";
    reason: string;
  }>;
  driftNotes: string[];
  confidence: Confidence;
}
