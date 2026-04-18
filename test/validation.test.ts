import test from "node:test";
import assert from "node:assert/strict";
import { inputSchema } from "../src/core/schema.js";
import { normalizeInput, normalizePublicImageUrl, normalizePublicUrl } from "../src/core/validation.js";

test("normalizePublicUrl rejects localhost URLs", () => {
  assert.throws(() => normalizePublicUrl("http://localhost:3000"), /public URLs/);
});

test("normalizeInput applies defaults and deduplicates URLs", () => {
  const normalized = normalizeInput({
    urls: ["https://example.com", "https://example.com#hero"],
  });

  assert.deepEqual(normalized.references, [{ type: "url", value: "https://example.com/" }]);
  assert.equal(normalized.synthesisMode, "single-site-profile");
  assert.equal(normalized.evidenceMode, "omit");
});

test("normalizeInput defaults to cross-site synthesis for multiple URLs", () => {
  const normalized = normalizeInput({
    urls: ["https://example.com", "https://example.org"],
    evidenceMode: "inline",
  });

  assert.deepEqual(normalized.references, [
    { type: "url", value: "https://example.com/" },
    { type: "url", value: "https://example.org/" },
  ]);
  assert.equal(normalized.synthesisMode, "cross-site-commonality");
  assert.equal(normalized.evidenceMode, "inline");
});

test("normalizeInput accepts mixed url and image references", () => {
  const normalized = normalizeInput({
    references: [
      { type: "url", value: "https://example.com#top" },
      { type: "image", value: "https://cdn.example.com/reference.png#fragment" },
    ],
  });

  assert.deepEqual(normalized.references, [
    { type: "url", value: "https://example.com/" },
    { type: "image", value: "https://cdn.example.com/reference.png" },
  ]);
  assert.equal(normalized.synthesisMode, "cross-site-commonality");
});

test("normalizePublicImageUrl rejects non-image paths", () => {
  assert.throws(() => normalizePublicImageUrl("https://example.com/reference"), /image URL/i);
});

test("inputSchema accepts exact-url input without crawl flags", () => {
  const parsed = inputSchema.parse({
    urls: ["https://example.com"],
    evidenceMode: "file",
  });

  assert.deepEqual(parsed.urls, ["https://example.com"]);
  assert.equal(parsed.evidenceMode, "file");
});

test("inputSchema accepts mixed references input", () => {
  const parsed = inputSchema.parse({
    references: [
      { type: "url", value: "https://example.com" },
      { type: "image", value: "https://cdn.example.com/reference.png" },
    ],
  });

  assert.equal(parsed.references?.length, 2);
});

test("inputSchema rejects synthesisMode as a public input", () => {
  assert.throws(() => inputSchema.parse({
    urls: ["https://example.com"],
    synthesisMode: "cross-site-commonality",
  }));
});
