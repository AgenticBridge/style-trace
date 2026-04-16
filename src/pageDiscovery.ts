import type { Page } from "playwright";

const preferredSegments = [
  "pricing",
  "features",
  "product",
  "platform",
  "about",
  "company",
  "solutions",
  "customers",
  "security",
  "enterprise",
  "contact",
];

const avoidedSegments = [
  "login",
  "signup",
  "sign-up",
  "register",
  "auth",
  "app",
  "dashboard",
  "docs",
  "blog",
  "privacy",
  "terms",
  "cookie",
  "legal",
  "careers",
  "jobs",
];

export async function discoverInternalPages(page: Page, maxPages: number): Promise<string[]> {
  if (maxPages <= 1) {
    return [];
  }

  const currentUrl = new URL(page.url());
  const currentPath = normalizePath(currentUrl.pathname);
  const links = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll("a[href]"));

    return anchors.map((anchor) => {
      const href = anchor.getAttribute("href") ?? "";
      const text = (anchor.textContent ?? "").trim().replace(/\s+/g, " ");
      const region = anchor.closest("nav")
        ? "nav"
        : anchor.closest("header")
          ? "header"
          : anchor.closest("footer")
            ? "footer"
            : anchor.closest("main")
              ? "main"
              : "other";

      return { href, text, region };
    });
  });

  const scored = new Map<string, number>();
  for (const link of links) {
    let resolved: URL;
    try {
      resolved = new URL(link.href, currentUrl);
    } catch {
      continue;
    }

    if (resolved.origin !== currentUrl.origin) {
      continue;
    }

    if (!["http:", "https:"].includes(resolved.protocol)) {
      continue;
    }

    if (resolved.hash) {
      resolved.hash = "";
    }

    const path = normalizePath(resolved.pathname);
    if (path === "/" || path === currentPath) {
      continue;
    }

    const score = scorePath(path, link.text, link.region);
    if (score <= 0) {
      continue;
    }

    const key = `${resolved.origin}${path}`;
    const previous = scored.get(key) ?? Number.NEGATIVE_INFINITY;
    if (score > previous) {
      scored.set(key, score);
    }
  }

  return [...scored.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, Math.max(0, maxPages - 1))
    .map(([url]) => url);
}

function scorePath(path: string, text: string, region: string): number {
  const lowerPath = path.toLowerCase();
  const lowerText = text.toLowerCase();

  if (avoidedSegments.some((segment) => lowerPath.includes(segment) || lowerText.includes(segment))) {
    return -10;
  }

  let score = 1;
  if (region === "nav" || region === "header") {
    score += 4;
  }

  if (region === "footer") {
    score += 1;
  }

  for (const segment of preferredSegments) {
    if (lowerPath.includes(segment) || lowerText.includes(segment)) {
      score += 6;
    }
  }

  const depth = lowerPath.split("/").filter(Boolean).length;
  score -= Math.max(0, depth - 2);
  return score;
}

function normalizePath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}
