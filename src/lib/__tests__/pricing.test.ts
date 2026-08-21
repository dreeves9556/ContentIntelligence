import {
  calculateCommunityTotal,
  SOLO_ANNUAL_CENTS,
  SOLO_MONTHLY_CENTS,
} from "../pricing";

let failures = 0;

function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    failures++;
  }
}

assert(SOLO_MONTHLY_CENTS === 10000, "Solo monthly price is $100");
assert(SOLO_ANNUAL_CENTS === 100000, "Solo annual price is $1,000");
assert(
  calculateCommunityTotal(5, "monthly") === 78000,
  "Community monthly pricing remains unchanged"
);
assert(
  calculateCommunityTotal(5, "annual") === 780000,
  "Community annual pricing remains unchanged"
);

if (failures > 0) process.exitCode = 1;
