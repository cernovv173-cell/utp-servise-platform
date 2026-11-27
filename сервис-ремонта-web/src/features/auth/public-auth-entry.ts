export type PublicAuthIntent = "login" | "register";

export type PublicAuthRequest = {
  intent: PublicAuthIntent;
  nextPath: string;
};

const getSafeNextPath = (value: string | null, fallback: string) =>
  value?.startsWith("/") && !value.startsWith("//") ? value : fallback;

export const getPublicAuthRequestFromSearch = (search: string): PublicAuthRequest | null => {
  const params = new URLSearchParams(search);
  const referralCode = params.get("ref")?.trim();
  const requestedIntent = params.get("auth");
  const shouldRegister =
    requestedIntent === "register" || params.get("register") === "1" || Boolean(referralCode);

  if (!shouldRegister && requestedIntent !== "login" && params.get("login") !== "1") return null;

  const intent = shouldRegister ? "register" : "login";
  return {
    intent,
    nextPath: getSafeNextPath(params.get("next"), intent === "register" ? "/orders" : "/"),
  };
};

export const createPublicAuthHref = (
  intent: PublicAuthIntent,
  nextPath = "/",
  referralCode?: string,
) => {
  const params = new URLSearchParams({
    auth: intent,
    next: getSafeNextPath(nextPath, intent === "register" ? "/orders" : "/"),
  });
  const normalizedReferralCode = referralCode?.trim();
  if (normalizedReferralCode) params.set("ref", normalizedReferralCode);
  return `/?${params.toString()}`;
};
