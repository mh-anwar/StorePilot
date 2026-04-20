import { redirect } from "next/navigation";

// Legacy URL. The original four-agents "automations" surface has been
// replaced by the full workflow engine. We keep this redirect so old
// bookmarks and docs don't 404.
export default function AutomationsPage() {
  redirect("/dashboard/workflows");
}
