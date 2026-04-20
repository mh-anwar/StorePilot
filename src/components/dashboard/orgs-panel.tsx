"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, UserPlus } from "lucide-react";

type Org = { id: string; name: string; slug: string; role: string };
type Member = { userId: string; email: string; name: string | null; role: string };

export function OrgsPanel({
  orgs,
  activeOrgId,
  members,
  myRole,
}: {
  orgs: Org[];
  activeOrgId: string | null;
  members: Member[];
  myRole: "owner" | "admin" | "staff" | null;
}) {
  const [newOrgName, setNewOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "staff">("staff");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function switchTo(id: string) {
    start(async () => {
      await fetch("/api/auth/switch-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: id }),
      });
      router.refresh();
    });
  }

  function createOrg() {
    if (!newOrgName) return;
    start(async () => {
      const r = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOrgName }),
      });
      if (!r.ok) {
        setErr(((await r.json()).error as string) ?? "failed");
        return;
      }
      setNewOrgName("");
      router.refresh();
    });
  }

  function invite() {
    if (!inviteEmail || !activeOrgId) return;
    setErr(null);
    start(async () => {
      const r = await fetch(`/api/orgs/${activeOrgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (!r.ok) {
        setErr(((await r.json()).error as string) ?? "failed");
        return;
      }
      setInviteEmail("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="border border-border rounded-xl p-5">
        <h2 className="font-semibold mb-3">Your organizations</h2>
        <div className="space-y-2">
          {orgs.map((o) => (
            <div
              key={o.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                o.id === activeOrgId
                  ? "border-violet-600 bg-violet-600/5"
                  : "border-border"
              }`}
            >
              <div>
                <p className="font-medium">{o.name}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {o.slug} · {o.role}
                </p>
              </div>
              {o.id === activeOrgId ? (
                <span className="text-xs text-violet-500">active</span>
              ) : (
                <button
                  onClick={() => switchTo(o.id)}
                  disabled={pending}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted"
                >
                  Switch
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <input
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            placeholder="New org name"
            className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm"
          />
          <button
            onClick={createOrg}
            disabled={pending || !newOrgName}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            Create
          </button>
        </div>
      </section>

      {activeOrgId && (
        <section className="border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-3">Members</h2>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2">User</th>
                  <th className="text-left px-3 py-2">Role</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.userId} className="border-t border-border">
                    <td className="px-3 py-2">
                      <p className="font-medium">{m.name ?? m.email}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className="bg-muted px-2 py-0.5 rounded">
                        {m.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(myRole === "owner" || myRole === "admin") && (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground mb-2">
                Invite a teammate. They need an existing StorePilot account.
              </p>
              <div className="flex gap-2">
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  type="email"
                  className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "admin" | "staff")}
                  className="px-2 py-2 rounded-lg bg-muted border border-border text-sm"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  onClick={invite}
                  disabled={pending || !inviteEmail}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50"
                >
                  <UserPlus className="h-3 w-3" />
                  Invite
                </button>
              </div>
            </div>
          )}
          {err && <p className="text-sm text-red-500 mt-2">{err}</p>}
        </section>
      )}
    </div>
  );
}
