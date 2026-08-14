// Errors whose message is written for the merchant. Route actions catch these
// and show the message in a banner; anything else is logged and shown generically.

export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

export class PlanLimitError extends UserFacingError {
  constructor(
    public readonly used: number,
    public readonly limit: number,
  ) {
    super(
      `You've used all ${limit} evidence packs included in your plan this month. Upgrade to keep building packs.`,
    );
    this.name = "PlanLimitError";
  }
}

export function messageOf(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  console.error(error);
  return "Something went wrong talking to Shopify. Try again in a minute.";
}
