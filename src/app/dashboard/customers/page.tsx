import Link from "next/link";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { desc, sql, and, eq } from "drizzle-orm";
import { getCurrentOrgId } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const orgId = await getCurrentOrgId();
  const rows = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.orgId, orgId),
        q
          ? sql`(${customers.email} ILIKE ${"%" + q + "%"} OR ${customers.firstName} ILIKE ${"%" + q + "%"} OR ${customers.lastName} ILIKE ${"%" + q + "%"})`
          : sql`true`
      )
    )
    .orderBy(desc(customers.totalSpent))
    .limit(100);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground text-sm">
            {rows.length} customers {q && `matching "${q}"`}
          </p>
        </div>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by email or name"
            className="px-3 py-2 rounded-lg bg-muted text-sm w-72 border border-border"
          />
          <button className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm">
            Search
          </button>
        </form>
      </div>
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3">Customer</th>
              <th className="text-left px-4 py-3">Location</th>
              <th className="text-left px-4 py-3">Orders</th>
              <th className="text-right px-4 py-3">Lifetime spend</th>
              <th className="text-left px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/customers/${c.id}`}
                    className="hover:underline"
                  >
                    <p className="font-medium">
                      {c.firstName} {c.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {c.city ? `${c.city}, ${c.state ?? ""}` : "—"}
                </td>
                <td className="px-4 py-3">{c.totalOrders}</td>
                <td className="px-4 py-3 text-right font-mono">
                  ${parseFloat(c.totalSpent ?? "0").toFixed(2)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
