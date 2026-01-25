export const STORE_NAME = "StorePilot Demo Store";
export const AGENT_MODEL = "claude-sonnet-4-20250514";
export const MAX_AGENT_STEPS = 10;
export const CATEGORIES = [
  "Apparel",
  "Electronics",
  "Home & Kitchen",
  "Beauty",
  "Sports",
  "Accessories",
] as const;

export const UTM_SOURCES = [
  "google",
  "facebook",
  "instagram",
  "email",
  "direct",
  "tiktok",
  "organic",
] as const;

export const UTM_MEDIUMS = [
  "cpc",
  "social",
  "email",
  "organic",
  "referral",
] as const;
