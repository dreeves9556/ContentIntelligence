import { isBetaUser, BETA_TAG } from "../account-access";

function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

assert(BETA_TAG === "BETA", "BETA_TAG is the string BETA");

assert(isBetaUser({ internalTag: "BETA" }), "BETA tag is beta");
assert(!isBetaUser({ internalTag: "KWLG" }), "KWLG tag is not beta");
assert(!isBetaUser({ internalTag: null }), "null tag is not beta");
assert(!isBetaUser({ internalTag: "beta" }), "tag is case-sensitive (lowercase beta is not beta)");
assert(!isBetaUser({ internalTag: "" }), "empty string tag is not beta");
