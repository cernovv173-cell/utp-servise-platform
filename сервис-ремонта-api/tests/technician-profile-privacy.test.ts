import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createStaffRouter } from "../src/features/staff/staff.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("technician home address is returned only to its owner and administrators", async (t) => {
  const tokens = {
    admin: "A".repeat(48),
    technician: "T".repeat(48),
    anotherTechnician: "O".repeat(48),
    customer: "C".repeat(48),
  };
  const technicianId = "11111111-1111-4111-8111-111111111111";
  const users = [
    {
      id: "22222222-2222-4222-8222-222222222222",
      email: "admin@example.test",
      displayName: "Администратор",
      phoneNumber: null,
      avatarObjectId: null,
      role: "ADMIN" as const,
      active: true,
      mustChangePassword: false,
      token: tokens.admin,
    },
    {
      id: technicianId,
      email: "technician@example.test",
      displayName: "Мастер",
      phoneNumber: "+7 900 123-45-67",
      avatarObjectId: "technician-avatar",
      role: "TECHNICIAN" as const,
      active: true,
      mustChangePassword: false,
      token: tokens.technician,
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      email: "another-technician@example.test",
      displayName: "Другой мастер",
      phoneNumber: null,
      avatarObjectId: null,
      role: "TECHNICIAN" as const,
      active: true,
      mustChangePassword: false,
      token: tokens.anotherTechnician,
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      email: "customer@example.test",
      displayName: "Клиент",
      phoneNumber: null,
      avatarObjectId: null,
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
      token: tokens.customer,
    },
  ];
  const profile = {
    userId: technicianId,
    experienceYears: 8,
    homeAddress: "Конфиденциальный адрес, 10",
    bio: "Опытный мастер",
    certificates: [],
    isVerified: false,
    verifiedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    user: {
      id: technicianId,
      displayName: "Мастер",
      phoneNumber: "+7 900 123-45-67",
      avatarObjectId: "technician-avatar",
      role: "TECHNICIAN" as const,
    },
  };
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = users.find(
          (entry) => hashSessionToken(entry.token) === where.tokenHash,
        );
        return user ? { expiresAt: new Date(Date.now() + 60_000), user } : null;
      },
    },
    technicianProfile: {
      findUnique: async () => profile,
      upsert: async () => profile,
    },
    user: {
      findFirst: async () => ({ id: technicianId }),
      update: async () => ({
        id: technicianId,
        displayName: "Мастер",
        avatarObjectId: "technician-avatar",
        phoneNumber: "+7 900 123-45-67",
      }),
    },
    repairOrder: {
      count: async () => 3,
    },
    review: {
      findMany: async () => [
        {
          id: "55555555-5555-4555-8555-555555555555",
          rating: 5,
          comment: "Хорошо",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
          customer: { displayName: "Клиент" },
          order: { deviceType: "PHONE" },
        },
      ],
    },
    repairOrderPhoto: {
      findMany: async () => [],
    },
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createStaffRouter(database as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/staff/${technicianId}/profile`;
  const readProfile = async (token: string) => {
    const response = await fetch(endpoint, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    return (await response.json()).profile as Record<string, unknown>;
  };

  const ownerProfile = await readProfile(tokens.technician);
  assert.equal(ownerProfile.homeAddress, profile.homeAddress);

  const adminProfile = await readProfile(tokens.admin);
  assert.equal(adminProfile.homeAddress, profile.homeAddress);

  const customerProfile = await readProfile(tokens.customer);
  assert.equal(
    customerProfile.user &&
      (customerProfile.user as { displayName: string }).displayName,
    "Мастер",
  );
  assert.equal(Object.hasOwn(customerProfile, "homeAddress"), false);

  const otherTechnicianProfile = await readProfile(tokens.anotherTechnician);
  assert.equal(Object.hasOwn(otherTechnicianProfile, "homeAddress"), false);

  for (const view of [
    ownerProfile,
    adminProfile,
    customerProfile,
    otherTechnicianProfile,
  ]) {
    assert.equal(Object.hasOwn(view, "isVerified"), false);
    assert.equal(Object.hasOwn(view, "verifiedAt"), false);
  }

  const saveResponse = await fetch(endpoint, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${tokens.technician}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      displayName: "Мастер",
      phoneNumber: "+7 900 123-45-67",
      experienceYears: 8,
      homeAddress: profile.homeAddress,
    }),
  });
  assert.equal(saveResponse.status, 200);
  const savedProfile = (await saveResponse.json()).profile as Record<
    string,
    unknown
  >;
  assert.equal(savedProfile.homeAddress, profile.homeAddress);
  assert.equal(Object.hasOwn(savedProfile, "isVerified"), false);
  assert.equal(Object.hasOwn(savedProfile, "verifiedAt"), false);

  const verificationResponse = await fetch(`${endpoint}/verification`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${tokens.admin}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ isVerified: true }),
  });
  assert.equal(verificationResponse.status, 404);
});
