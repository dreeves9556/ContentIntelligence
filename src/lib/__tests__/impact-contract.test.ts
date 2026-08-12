import {
  IMPACT_DEFINITION_VERSION,
  impactSourceFingerprint,
} from "../impact-contract";

function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

const first = impactSourceFingerprint({ b: 2, a: 1 });
const second = impactSourceFingerprint({ a: 1, b: 2 });
const changed = impactSourceFingerprint({ a: 1, b: 3 });

assert(first === second, "impact fingerprints are stable across object key order");
assert(first !== changed, "impact fingerprints change when metric data changes");
assert(IMPACT_DEFINITION_VERSION === "connection-period-v1", "impact metric definition is versioned");
