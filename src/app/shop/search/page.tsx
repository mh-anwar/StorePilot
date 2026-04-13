import { redirect } from "next/navigation";

export default async function Search({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  redirect(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
}
