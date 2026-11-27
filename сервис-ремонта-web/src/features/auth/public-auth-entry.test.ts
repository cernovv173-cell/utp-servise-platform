import { describe, expect, it } from "vitest";

import { createPublicAuthHref, getPublicAuthRequestFromSearch } from "./public-auth-entry";

describe("public auth entry", () => {
  it("opens login with its return path", () => {
    expect(getPublicAuthRequestFromSearch("?auth=login&next=%2Forders%3Ftab%3Dactive")).toEqual({
      intent: "login",
      nextPath: "/orders?tab=active",
    });
  });

  it("opens registration for legacy links and referral invitations", () => {
    expect(getPublicAuthRequestFromSearch("?register=1&next=%2Forders")).toEqual({
      intent: "register",
      nextPath: "/orders",
    });
    expect(getPublicAuthRequestFromSearch("?ref=FRIEND123")).toEqual({
      intent: "register",
      nextPath: "/orders",
    });
  });

  it("ignores unrelated queries and rejects external return paths", () => {
    expect(getPublicAuthRequestFromSearch("?campaign=spring")).toBeNull();
    expect(getPublicAuthRequestFromSearch("?auth=login&next=%2F%2Fevil.example")).toEqual({
      intent: "login",
      nextPath: "/",
    });
  });

  it("creates a site URL for login, registration, and referral entry", () => {
    expect(createPublicAuthHref("login", "/account")).toBe("/?auth=login&next=%2Faccount");
    expect(createPublicAuthHref("register", "/orders", "FRIEND 123")).toBe(
      "/?auth=register&next=%2Forders&ref=FRIEND+123",
    );
  });
});
