export type ActionResult =
  | { ok: true; message: string }
  // code "plan_limit": the monthly pack allowance is used up; the UI offers an upgrade.
  | { ok: false; error: string; code?: "plan_limit" };
