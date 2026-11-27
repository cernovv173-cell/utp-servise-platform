import { describe, expect, it } from "vitest";

import {
  getHelpNavigationLinksForUser,
  getNavigationGroupsForUser,
  isNavigationItemActive,
} from "@/features/navigation/navigation-model";

import type { StaffPermission, User } from "@/lib/api";

const makeUser = (role: User["role"], permissions?: StaffPermission[]): User => ({
  id: "user-1",
  email: "staff@example.test",
  displayName: "Test User",
  role,
  mustChangePassword: false,
  ...(permissions === undefined ? {} : { permissions }),
});

const routesFor = (user: User) =>
  getNavigationGroupsForUser(user).flatMap((group) => group.links.map((link) => link.to));

describe("permission-aware navigation", () => {
  it("keeps the customer workspace to five consistent sections", () => {
    expect(routesFor(makeUser("CUSTOMER"))).toEqual([
      "/",
      "/orders",
      "/shop",
      "/loyalty",
      "/account",
    ]);
  });

  it("preserves the legacy repair-only view", () => {
    expect(routesFor(makeUser("TECHNICIAN"))).toEqual([
      "/orders",
      "/checks",
      "/salary",
      "/catalog",
      "/account",
    ]);
  });

  it("builds employee navigation from saved permissions instead of a job title", () => {
    expect(routesFor(makeUser("STAFF", ["inventory"]))).toEqual([
      "/catalog",
      "/admin/procurement",
      "/account",
    ]);
    expect(routesFor(makeUser("STAFF", ["repairs", "communications"]))).toEqual([
      "/orders",
      "/checks",
      "/salary",
      "/catalog",
      "/admin",
      "/account",
    ]);
    expect(routesFor(makeUser("STAFF", []))).toEqual(["/account"]);
  });

  it("gives administrators a direct link to the repair order list", () => {
    expect(routesFor(makeUser("ADMIN"))).toContain("/admin/orders");
  });

  it("keeps secondary management screens out of the primary menu", () => {
    const customerRoutes = routesFor(makeUser("CUSTOMER"));
    const inventoryRoutes = routesFor(makeUser("STAFF", ["inventory"]));

    expect(customerRoutes).not.toContain("/offers");
    expect(customerRoutes).not.toContain("/reviews");
    expect(customerRoutes).not.toContain("/support");
    expect(inventoryRoutes).not.toContain("/admin/staff");
    expect(inventoryRoutes).not.toContain("/admin/customers");
  });

  it("marks nested routes active without matching root destinations", () => {
    expect(isNavigationItemActive("/admin/orders/123", "/admin/orders")).toBe(true);
    expect(isNavigationItemActive("/admin/schedule", "/admin")).toBe(false);
    expect(isNavigationItemActive("/orders", "/")).toBe(false);
  });
});

describe("permission-aware help navigation", () => {
  it("keeps customer help links unchanged", () => {
    expect(getHelpNavigationLinksForUser(makeUser("CUSTOMER")).map((link) => link.to)).toEqual([
      "/chats",
      "/guides",
      "/support",
      "/feedback",
    ]);
  });

  it("shows employees only the help sections allowed by their rights", () => {
    expect(getHelpNavigationLinksForUser(makeUser("ADMIN")).map((link) => link.to)).toEqual([
      "/chats",
      "/support",
    ]);
    expect(
      getHelpNavigationLinksForUser(makeUser("STAFF", ["repairs"])).map((link) => link.to),
    ).toEqual(["/chats"]);
    expect(
      getHelpNavigationLinksForUser(makeUser("STAFF", ["communications"])).map((link) => link.to),
    ).toEqual(["/chats", "/support"]);
    expect(getHelpNavigationLinksForUser(makeUser("STAFF", ["inventory"]))).toEqual([]);
  });

  it("marks a customer support conversation as part of the help section", () => {
    expect(isNavigationItemActive("/support/123", "/support")).toBe(true);
    expect(isNavigationItemActive("/chats", "/support")).toBe(false);
    expect(isNavigationItemActive("/guides/thermal-paste", "/guides")).toBe(true);
  });
});
