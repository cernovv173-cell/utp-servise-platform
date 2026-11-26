import assert from "node:assert/strict";
import test from "node:test";

import {
  isStaffAccountRole,
  matchesLoginPortal,
} from "../src/features/auth/login-portal.js";

test("the staff login portal accepts every current staff role only", () => {
  for (const role of ["TECHNICIAN", "PROCUREMENT", "ADMIN"]) {
    assert.equal(isStaffAccountRole(role), true);
    assert.equal(matchesLoginPortal("STAFF", role), true);
  }

  for (const role of ["CUSTOMER", "UNKNOWN"]) {
    assert.equal(isStaffAccountRole(role), false);
    assert.equal(matchesLoginPortal("STAFF", role), false);
  }
});

test("customer login remains limited to customer accounts", () => {
  assert.equal(matchesLoginPortal("CUSTOMER", "CUSTOMER"), true);
  assert.equal(matchesLoginPortal("CUSTOMER", "ADMIN"), false);
  assert.equal(matchesLoginPortal("CUSTOMER", "TECHNICIAN"), false);
});

test("legacy supported role-specific login requests keep exact matching", () => {
  assert.equal(matchesLoginPortal("ADMIN", "ADMIN"), true);
  assert.equal(matchesLoginPortal("ADMIN", "TECHNICIAN"), false);
  assert.equal(matchesLoginPortal("TECHNICIAN", "TECHNICIAN"), true);
  assert.equal(matchesLoginPortal("TECHNICIAN", "STAFF"), false);
  assert.equal(matchesLoginPortal("PROCUREMENT", "PROCUREMENT"), false);
});
