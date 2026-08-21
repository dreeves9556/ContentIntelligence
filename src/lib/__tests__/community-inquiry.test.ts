import { validateCommunityInquiry } from "../community-inquiry";

let failures = 0;

function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    failures++;
  }
}

const validInquiry = {
  name: "Dylan Ballard",
  email: "prospect@example.com",
  phone: "(555) 123-4567",
  organization: "Springfield Realty",
  estimatedMembers: "10-20",
  message: "We would like to discuss a custom plan for our team.",
  requestId: "123e4567-e89b-12d3-a456-426614174000",
};

const validResult = validateCommunityInquiry(validInquiry);
assert(validResult.success, "Valid community inquiry is accepted");
if (validResult.success) {
  assert(validResult.data.email === "prospect@example.com", "Email is normalized");
  assert(validResult.data.organization === "Springfield Realty", "Fields are trimmed");
}

assert(
  !validateCommunityInquiry({ ...validInquiry, email: "not-an-email" }).success,
  "Invalid email is rejected"
);
assert(
  !validateCommunityInquiry({ ...validInquiry, message: "Too short" }).success,
  "Short message is rejected"
);
assert(
  !validateCommunityInquiry({ ...validInquiry, requestId: "not-a-uuid" }).success,
  "Invalid request ID is rejected"
);
assert(
  !validateCommunityInquiry({ ...validInquiry, estimatedMembers: "" }).success,
  "Missing member estimate is rejected"
);
assert(
  !validateCommunityInquiry({ ...validInquiry, phone: "123" }).success,
  "Invalid phone number is rejected"
);

if (failures > 0) process.exitCode = 1;
