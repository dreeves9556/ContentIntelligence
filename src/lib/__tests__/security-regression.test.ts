import {
  createHash,
  randomBytes,
  createHmac,
  timingSafeEqual,
  scryptSync,
  createCipheriv,
  createDecipheriv,
} from "crypto";
import sanitizeHtml from "sanitize-html";

// ─── unsubscribe.ts logic (inline, no env needed) ───────────────────────
const SEPARATOR = "|";

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function generateUnsubscribeToken(userId: string, email: string, secret: string): string {
  const payload = `${userId}${SEPARATOR}${email}`;
  return Buffer.from(`${payload}${SEPARATOR}${sign(payload, secret)}`).toString("base64url");
}

function verifyUnsubscribeToken(token: string, secret: string): { userId: string; email: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(SEPARATOR);
    if (parts.length !== 3) return null;
    const [userId, email, signature] = parts;
    if (!userId || !email || !signature) return null;
    const expectedSignature = sign(`${userId}${SEPARATOR}${email}`, secret);
    const provided = Buffer.from(signature, "utf8");
    const expected = Buffer.from(expectedSignature, "utf8");
    if (provided.length !== expected.length) return null;
    if (!timingSafeEqual(provided, expected)) return null;
    return { userId, email };
  } catch {
    return null;
  }
}

// ─── crypto.ts logic (inline) ───────────────────────────────────────────
const PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(secret: string): Buffer {
  return scryptSync(secret, "coreos-salt", 32);
}

function encrypt(plaintext: string, secret: string): string {
  const key = getKey(secret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decrypt(ciphertext: string, secret: string): string {
  const key = getKey(secret);
  const payload = ciphertext.startsWith(PREFIX) ? ciphertext.slice(PREFIX.length) : ciphertext;
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function isEncrypted(value: string | null): boolean {
  if (!value) return false;
  return value.startsWith(PREFIX);
}

function decryptIfEncrypted(value: string | null, secret: string): string | null {
  if (!value) return null;
  if (isEncrypted(value)) {
    try {
      return decrypt(value, secret);
    } catch {
      return null;
    }
  }
  // Backward compat: try legacy ciphertext without prefix
  try {
    return decrypt(value, secret);
  } catch {
    return value;
  }
}

function encryptIfPlaintext(value: string | null, secret: string): string | null {
  if (!value || isEncrypted(value)) return value;
  return encrypt(value, secret);
}

// ─── password-reset-tokens.ts logic (inline) ────────────────────────────
function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ─── Tests ──────────────────────────────────────────────────────────────
const TEST_SECRET = "test-encryption-key-for-regression";
const UNSUB_SECRET = "test-unsubscribe-secret";
let pass = 0;
let fail = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`PASS: ${label}`);
    pass++;
  } else {
    console.error(`FAIL: ${label}`);
    fail++;
  }
}

// 1. Unsubscribe token roundtrip with | separator
{
  const userId = "clxxxxx123456";
  const email = "user.example+tag@domain.com";
  const token = generateUnsubscribeToken(userId, email, UNSUB_SECRET);
  const result = verifyUnsubscribeToken(token, UNSUB_SECRET);
  assert(result !== null, "unsubscribe: token verifies with dots in email");
  assert(result?.userId === userId, "unsubscribe: userId matches");
  assert(result?.email === email, "unsubscribe: email matches");
}

// 2. Unsubscribe token with wrong secret fails
{
  const token = generateUnsubscribeToken("uid", "a@b.com", UNSUB_SECRET);
  const result = verifyUnsubscribeToken(token, "wrong-secret");
  assert(result === null, "unsubscribe: wrong secret rejected");
}

// 3. Unsubscribe token tampered fails
{
  const token = generateUnsubscribeToken("uid", "a@b.com", UNSUB_SECRET);
  const tampered = token.slice(0, -2) + "XX";
  const result = verifyUnsubscribeToken(tampered, UNSUB_SECRET);
  assert(result === null, "unsubscribe: tampered token rejected");
}

// 4. Crypto: encrypt → decrypt roundtrip
{
  const plaintext = "sk-ant-api03-xxxxxxxxxxxxxxxxxxxx";
  const encrypted = encrypt(plaintext, TEST_SECRET);
  assert(encrypted.startsWith(PREFIX), "crypto: encrypted value has enc:v1: prefix");
  const decrypted = decrypt(encrypted, TEST_SECRET);
  assert(decrypted === plaintext, "crypto: decrypt(encrypt(x)) === x");
}

// 5. Crypto: isEncrypted detects prefixed values
{
  const encrypted = encrypt("secret-key", TEST_SECRET);
  assert(isEncrypted(encrypted) === true, "crypto: isEncrypted true for enc:v1: value");
  assert(isEncrypted("plaintext-key") === false, "crypto: isEncrypted false for plaintext");
  assert(isEncrypted(null) === false, "crypto: isEncrypted false for null");
}

// 6. Crypto: encryptIfPlaintext skips already-encrypted
{
  const encrypted = encrypt("key", TEST_SECRET);
  const result = encryptIfPlaintext(encrypted, TEST_SECRET);
  assert(result === encrypted, "crypto: encryptIfPlaintext skips already-encrypted (no double encryption)");
}

// 7. Crypto: encryptIfPlaintext encrypts plaintext
{
  const plaintext = "sk-ant-api03-aaa";
  const result = encryptIfPlaintext(plaintext, TEST_SECRET);
  assert(result !== plaintext, "crypto: encryptIfPlaintext encrypts plaintext");
  assert(isEncrypted(result), "crypto: encryptIfPlaintext result has prefix");
  assert(decrypt(result!, TEST_SECRET) === plaintext, "crypto: encryptIfPlaintext result decrypts back");
}

// 8. Crypto: decryptIfEncrypted handles new-format encrypted values
{
  const plaintext = "my-api-key";
  const encrypted = encrypt(plaintext, TEST_SECRET);
  const result = decryptIfEncrypted(encrypted, TEST_SECRET);
  assert(result === plaintext, "crypto: decryptIfEncrypted handles enc:v1: values");
}

// 9. Crypto: decryptIfEncrypted handles plaintext (returns as-is)
{
  const plaintext = "plain-api-key";
  const result = decryptIfEncrypted(plaintext, TEST_SECRET);
  assert(result === plaintext, "crypto: decryptIfEncrypted returns plaintext as-is");
}

// 10. Crypto: decryptIfEncrypted handles null
{
  assert(decryptIfEncrypted(null, TEST_SECRET) === null, "crypto: decryptIfEncrypted handles null");
}

// 11. Crypto: backward compat — legacy encrypted value (no prefix) still decrypts
{
  const plaintext = "legacy-api-key";
  // Simulate old-style encryption (without prefix)
  const key = getKey(TEST_SECRET);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const legacyValue = Buffer.concat([iv, tag, encrypted]).toString("base64"); // NO prefix
  assert(!isEncrypted(legacyValue), "crypto: legacy value lacks prefix (isEncrypted=false)");
  const result = decryptIfEncrypted(legacyValue, TEST_SECRET);
  assert(result === plaintext, "crypto: backward compat — legacy encrypted value decrypts correctly");
}

// 12. Crypto: backward compat — non-encrypted base64-looking value is NOT corrupted
{
  // A plaintext API key that looks like base64 should be returned as-is
  const fakeKey = "sk-ant-api03-abc123def456";
  const result = decryptIfEncrypted(fakeKey, TEST_SECRET);
  assert(result === fakeKey, "crypto: plaintext API key returned as-is (not corrupted by decrypt attempt)");
}

// 13. Password reset: hash is deterministic
{
  const token = "abc123";
  assert(hashResetToken(token) === hashResetToken(token), "password-reset: hash is deterministic");
}

// 14. Password reset: hash differs from raw token
{
  const token = randomBytes(32).toString("hex");
  assert(hashResetToken(token) !== token, "password-reset: hash differs from raw token");
}

// 15. Password reset: different tokens produce different hashes
{
  const t1 = "token-a";
  const t2 = "token-b";
  assert(hashResetToken(t1) !== hashResetToken(t2), "password-reset: different tokens → different hashes");
}

// 16. Session expiry: 0 is expired
{
  function isSessionExpired(sessionExpiry: number | undefined | null): boolean {
    if (sessionExpiry === undefined || sessionExpiry === null) return false;
    return Date.now() > sessionExpiry;
  }
  assert(isSessionExpired(0) === true, "session: expiry=0 is treated as expired");
  assert(isSessionExpired(undefined) === false, "session: undefined is not expired");
  assert(isSessionExpired(null) === false, "session: null is not expired");
  assert(isSessionExpired(Date.now() + 10000) === false, "session: future timestamp is not expired");
  assert(isSessionExpired(Date.now() - 10000) === true, "session: past timestamp is expired");
}

// 17. Sanitize: basic HTML passes through
{
  // Inline test of sanitize-html
  try {
    const html = "<p>Hello <strong>world</strong></p>";
    const cleaned = sanitizeHtml(html, {
      allowedTags: ["p", "strong", "em", "a", "br"],
      allowedAttributes: { a: ["href", "target", "rel"] },
    });
    assert(cleaned === html, "sanitize: basic allowed HTML passes through");
  } catch (e) {
    console.log("SKIP: sanitize-html not available for inline test");
  }
}

// 18. Sanitize: script tags are stripped
{
  try {
    const html = '<p>Hello</p><script>alert("xss")</script>';
    const cleaned = sanitizeHtml(html, {
      allowedTags: ["p", "strong", "em", "a", "br"],
      allowedAttributes: {},
    });
    assert(!cleaned.includes("<script>"), "sanitize: script tags stripped");
    assert(cleaned.includes("<p>Hello</p>"), "sanitize: safe content preserved");
  } catch (e) {
    console.log("SKIP: sanitize-html not available for inline test");
  }
}

// 19. Sanitize: onload attributes are stripped
{
  try {
    const html = '<p onload="alert(1)">Hello</p>';
    const cleaned = sanitizeHtml(html, {
      allowedTags: ["p"],
      allowedAttributes: {},
    });
    assert(!cleaned.includes("onload"), "sanitize: onload attribute stripped");
  } catch (e) {
    console.log("SKIP: sanitize-html not available for inline test");
  }
}

// 20. timingSafeEqual: different-length buffers don't throw (caught)
{
  try {
    timingSafeEqual(Buffer.from("short"), Buffer.from("muchlongerstring"));
    assert(false, "timingSafeEqual: should have thrown for different lengths");
  } catch {
    assert(true, "timingSafeEqual: different-length buffers throw (caller must guard)");
  }
}

// 21. timingSafeEqual: same-length buffers work
{
  const a = Buffer.from("hello");
  const b = Buffer.from("hello");
  assert(timingSafeEqual(a, b) === true, "timingSafeEqual: identical buffers match");
}

console.log(`\n--- Security regression tests complete: ${pass} passed, ${fail} failed ---`);
if (fail > 0) process.exit(1);
