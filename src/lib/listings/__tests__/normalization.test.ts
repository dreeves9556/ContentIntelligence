import { normalizeAddress, normalizeUrl, canonicalJsonStringify } from "../normalization";

function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// normalizeAddress
// ─────────────────────────────────────────────────────────────────────────────

assert(
  normalizeAddress({
    addressLine1: "123 Main St",
    city: "Austin",
    state: "TX",
    postalCode: "78701",
  }) === "123 main st, austin, tx, 78701",
  "normalizeAddress: basic address without line 2"
);

assert(
  normalizeAddress({
    addressLine1: "  456 Oak Avenue  ",
    addressLine2: " Apt 2B ",
    city: "Dallas",
    state: "tx",
    postalCode: "75201",
  }) === "456 oak avenue, apt 2b, dallas, tx, 75201",
  "normalizeAddress: trims and lowercases, includes line 2"
);

assert(
  normalizeAddress({
    addressLine1: "789 Pine St",
    addressLine2: null,
    city: "Houston",
    state: "TX",
    postalCode: "77001",
  }) === "789 pine st, houston, tx, 77001",
  "normalizeAddress: null line 2 is skipped"
);

assert(
  normalizeAddress({
    addressLine1: "  Multiple   Spaces  ",
    city: "  El  Paso  ",
    state: " TX ",
    postalCode: " 79901 ",
  }) === "multiple spaces, el paso, tx, 79901",
  "normalizeAddress: collapses internal whitespace"
);

// ─────────────────────────────────────────────────────────────────────────────
// normalizeUrl
// ─────────────────────────────────────────────────────────────────────────────

assert(
  normalizeUrl("https://example.com/listings/123") === "https://example.com/listings/123",
  "normalizeUrl: basic HTTPS URL unchanged"
);

assert(
  normalizeUrl("HTTPS://Example.COM/Path") === "https://example.com/Path",
  "normalizeUrl: lowercases scheme and host"
);

assert(
  normalizeUrl("https://example.com:443/path") === "https://example.com/path",
  "normalizeUrl: removes default HTTPS port"
);

assert(
  normalizeUrl("http://example.com:80/path") === "http://example.com/path",
  "normalizeUrl: removes default HTTP port"
);

assert(
  normalizeUrl("https://example.com/path#fragment") === "https://example.com/path",
  "normalizeUrl: removes fragment"
);

assert(
  normalizeUrl("https://example.com/path?utm_source=google&id=123") === "https://example.com/path?id=123",
  "normalizeUrl: removes tracking params, preserves others"
);

assert(
  normalizeUrl("https://example.com/path/") === "https://example.com/path",
  "normalizeUrl: removes trailing slash"
);

assert(
  normalizeUrl("https://example.com/") === "https://example.com",
  "normalizeUrl: root path becomes empty"
);

assert(
  normalizeUrl("not a url") === null,
  "normalizeUrl: invalid URL returns null"
);

assert(
  normalizeUrl("ftp://example.com/file") === null,
  "normalizeUrl: non-HTTP protocol returns null"
);

assert(
  normalizeUrl("https://example.com/path?fbclid=abc&gclid=def&keep=this") === "https://example.com/path?keep=this",
  "normalizeUrl: strips multiple tracking params"
);

// ─────────────────────────────────────────────────────────────────────────────
// canonicalJsonStringify
// ─────────────────────────────────────────────────────────────────────────────

assert(
  canonicalJsonStringify({ b: 2, a: 1 }) === canonicalJsonStringify({ a: 1, b: 2 }),
  "canonicalJsonStringify: key order does not matter"
);

assert(
  canonicalJsonStringify({ a: 1 }) === '{"a":1}',
  "canonicalJsonStringify: single key"
);

assert(
  canonicalJsonStringify({ b: { d: 4, c: 3 }, a: 1 }) === canonicalJsonStringify({ a: 1, b: { c: 3, d: 4 } }),
  "canonicalJsonStringify: nested key order does not matter"
);

assert(
  canonicalJsonStringify([3, 1, 2]) === '[3,1,2]',
  "canonicalJsonStringify: arrays preserve order"
);

assert(
  canonicalJsonStringify(null) === 'null',
  "canonicalJsonStringify: null"
);

assert(
  canonicalJsonStringify("hello") === '"hello"',
  "canonicalJsonStringify: string"
);

assert(
  canonicalJsonStringify({ a: { z: 1, y: 2 }, b: [3, 2, 1] }) === '{"a":{"y":2,"z":1},"b":[3,2,1]}',
  "canonicalJsonStringify: nested objects sorted, arrays preserved"
);
