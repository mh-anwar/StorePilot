import { redirect } from "next/navigation";

export default async function LegacyAutomationDetail() {
  redirect("/dashboard/workflows");
}
