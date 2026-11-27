import assert from "node:assert/strict";
import test from "node:test";

import {
  STAFF_ASSIGNABLE_PERMISSION_OPTIONS,
  STAFF_PERMISSION_OPTIONS,
  assertCanAssignPermissions,
  permissionsForUser,
} from "../src/features/auth/staff-permissions.js";

const employee = (
  role: "TECHNICIAN" | "PROCUREMENT" | "ADMIN",
  permissions: string[] = [],
  configured = true,
  isAdminAssistant = false,
) => ({
  role,
  staffPermissions: permissions,
  staffPermissionsConfigured: configured,
  isAdminAssistant,
});

test("configured employees receive only the permissions saved on their account", () => {
  assert.deepEqual(
    permissionsForUser(employee("TECHNICIAN", ["inventory", "communications"])),
    ["inventory", "communications"],
  );
  assert.deepEqual(permissionsForUser(employee("TECHNICIAN")), []);
});

test("legacy accounts keep their existing repair or inventory access", () => {
  assert.deepEqual(permissionsForUser(employee("TECHNICIAN", [], false)), [
    "repairs",
  ]);
  assert.deepEqual(permissionsForUser(employee("PROCUREMENT", [], false)), [
    "inventory",
  ]);
  assert.ok(
    permissionsForUser(employee("ADMIN", [], false, true)).includes(
      "staff_management",
    ),
  );
});

test("only the full administrator can assign or change employee permissions", () => {
  const staffWithRepairAndStaffManagement = employee("TECHNICIAN", [
    "repairs",
    "staff_management",
  ]);
  assert.throws(() =>
    assertCanAssignPermissions(staffWithRepairAndStaffManagement, ["repairs"]),
  );
  assert.throws(() =>
    assertCanAssignPermissions(staffWithRepairAndStaffManagement, ["reports"]),
  );
  assert.doesNotThrow(() =>
    assertCanAssignPermissions(employee("ADMIN"), [
      "reports",
      "staff_management",
    ]),
  );
  assert.throws(() =>
    assertCanAssignPermissions(employee("ADMIN", [], true, true), ["reports"]),
  );
  assert.ok(
    STAFF_ASSIGNABLE_PERMISSION_OPTIONS.some(
      ({ key }) => key === "staff_management",
    ),
  );
});

test("the permission catalog contains capabilities, not a procurement job title", () => {
  const permissionKeys = STAFF_PERMISSION_OPTIONS.map(({ key }) => key);
  assert.ok(permissionKeys.includes("inventory"));
  assert.ok(
    !permissionKeys.some((key) => key.toLowerCase().includes("procurement")),
  );
});
