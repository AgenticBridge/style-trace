import type { InputPayload } from "./schema.js";
import type { EvidenceMode, NormalizedInput, SynthesisMode } from "./types.js";

const localHostnames = new Set(["localhost", "0.0.0.0", "127.0.0.1", "::1"]);

export function normalizeInput(input: InputPayload): NormalizedInput {
  const urls = Array.from(new Set(input.urls.map((value) => normalizePublicUrl(value))));
  if (urls.length === 0) {
    throw new Error("Provide at least one public URL.");
  }

  return {
    urls,
    synthesisMode: resolveSynthesisMode(urls.length),
    evidenceMode: resolveEvidenceMode(input.evidenceMode),
  };
}

function resolveSynthesisMode(urlCount: number): SynthesisMode {
  return urlCount > 1 ? "cross-site-commonality" : "single-site-profile";
}

function resolveEvidenceMode(override: EvidenceMode | undefined): EvidenceMode {
  return override ?? "omit";
}

export function normalizePublicUrl(rawValue: string): string {
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

  parsed.hash = "";
  if ((parsed.protocol === "https:" && parsed.port === "443") || (parsed.protocol === "http:" && parsed.port === "80")) {
    parsed.port = "";
  }

  return parsed.toString();
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
