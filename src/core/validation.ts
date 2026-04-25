import type { InputPayload } from "./schema.js";
import type { EvidenceMode, Fidelity, NormalizedInput, ReferenceType, SynthesisMode, TargetArtifact } from "./types.js";

const localHostnames = new Set(["localhost", "0.0.0.0", "127.0.0.1", "::1"]);

export function normalizeInput(input: InputPayload): NormalizedInput {
  const references = dedupeReferences([
    ...(input.urls ?? []).map((value) => ({ type: "url" as const, value })),
    ...(input.references ?? []),
  ].map((reference) => ({
    type: reference.type,
    value: normalizeReferenceValue(reference.type, reference.value),
  })));

  if (references.length === 0) {
    throw new Error("Provide at least one public URL or image reference.");
  }

  return {
    references,
    synthesisMode: resolveSynthesisMode(references.length),
    evidenceMode: resolveEvidenceMode(input.evidenceMode),
    targetArtifact: resolveTargetArtifact(input.targetArtifact),
    fidelity: resolveFidelity(input.fidelity),
    ...(input.designIntent ? { designIntent: input.designIntent.trim() } : {}),
  };
}

function resolveSynthesisMode(urlCount: number): SynthesisMode {
  return urlCount > 1 ? "cross-site-commonality" : "single-site-profile";
}

function resolveEvidenceMode(override: EvidenceMode | undefined): EvidenceMode {
  return override ?? "omit";
}

function resolveTargetArtifact(override: TargetArtifact | undefined): TargetArtifact {
  return override ?? "landing-page";
}

function resolveFidelity(override: Fidelity | undefined): Fidelity {
  return override ?? "high";
}

export function normalizePublicUrl(rawValue: string): string {
  const parsed = normalizePublicHttpUrl(rawValue);
  parsed.hash = "";
  if ((parsed.protocol === "https:" && parsed.port === "443") || (parsed.protocol === "http:" && parsed.port === "80")) {
    parsed.port = "";
  }

  return parsed.toString();
}

export function normalizePublicImageUrl(rawValue: string): string {
  const parsed = normalizePublicHttpUrl(rawValue);
  if (!looksLikeImagePath(parsed.pathname)) {
    throw new Error(`Image references must point to a public image URL: ${rawValue.trim()}`);
  }

  parsed.hash = "";
  if ((parsed.protocol === "https:" && parsed.port === "443") || (parsed.protocol === "http:" && parsed.port === "80")) {
    parsed.port = "";
  }

  return parsed.toString();
}

function normalizeReferenceValue(type: ReferenceType, value: string): string {
  if (type === "url") {
    return normalizePublicUrl(value);
  }
  if (type === "image" || type === "screenshot") {
    return normalizePublicImageUrl(value);
  }
  return normalizeHtmlSnippet(value);
}

function normalizeHtmlSnippet(rawValue: string): string {
  const value = rawValue.trim();
  if (!value) {
    throw new Error("HTML snippets must be non-empty strings.");
  }
  if (value.length > 200_000) {
    throw new Error("HTML snippets must be 200000 characters or shorter.");
  }
  return value;
}

function normalizePublicHttpUrl(rawValue: string): URL {
  const value = rawValue.trim();
  if (!value) {
    throw new Error("URLs must be non-empty strings.");
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid URL: ${value}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Only http:// and https:// URLs are supported: ${value}`);
  }

  if (parsed.username || parsed.password) {
    throw new Error(`Authenticated URLs are not supported: ${value}`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (localHostnames.has(hostname) || hostname.endsWith(".local") || !hostname.includes(".")) {
    throw new Error(`Only public URLs are supported: ${value}`);
  }

  if (isPrivateIpv4(hostname)) {
    throw new Error(`Private-network URLs are not supported: ${value}`);
  }

  return parsed;
}

function dedupeReferences(references: NormalizedInput["references"]): NormalizedInput["references"] {
  const unique = new Map<string, { type: ReferenceType; value: string }>();
  for (const reference of references) {
    unique.set(`${reference.type}:${reference.value}`, reference);
  }
  return [...unique.values()];
}

function looksLikeImagePath(pathname: string): boolean {
  return /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(pathname);
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) {
    return false;
  }

  const octets = parts.map((part) => Number(part));
  const first = octets[0] ?? -1;
  const second = octets[1] ?? -1;
  return first === 10 || first === 127 || (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}
