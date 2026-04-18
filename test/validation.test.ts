import test from "node:test";
import assert from "node:assert/strict";
import { inputSchema } from "../src/core/schema.js";
import { normalizeInput, normalizePublicUrl } from "../src/core/validation.js";

test("normalizePublicUrl rejects localhost URLs", () => {
  assert.throws(() => normalizePublicUrl("http://localhost:3000"), /public URLs/);
});

test("normalizeInput applies defaults and deduplicates URLs", () => {
  const normalized = normalizeInput({
    urls: ["https://example.com", "https://example.com#hero"],
  });

  assert.deepEqual(normalized.urls, ["https://example.com/"]);
  assert.equal(normalized.synthesisMode, "single-site-profile");
  assert.equal(normalized.evidenceMode, "omit");
});

test("normalizeInput defaults to cross-site synthesis for multiple URLs", () => {
  const normalized = normalizeInput({
    urls: ["https://example.com", "https://example.org"],
    evidenceMode: "inline",
  });

  assert.deepEqual(normalized.urls, ["https://example.com/", "https://example.org/"]);
  assert.equal(normalized.synthesisMode, "cross-site-commonality");
  assert.equal(normalized.evidenceMode, "inline");
});

test("inputSchema accepts exact-url input without crawl flags", () => {
  const parsed = inputSchema.parse({
    urls: ["https://example.com"],
    evidenceMode: "file",
  });

  assert.deepEqual(parsed.urls, ["https://example.com"]);
  assert.equal(parsed.evidenceMode, "file");
});
