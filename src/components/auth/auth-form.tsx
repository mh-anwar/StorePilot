"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function AuthForm({ mode }: { mode: "signup" | "login" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const r = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, orgName }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error || "Something went wrong");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email" type="email" value={email} onChange={setEmail} required />
      <Field
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        required
        hint={mode === "signup" ? "At least 8 characters" : undefined}
      />
      {mode === "signup" && (
        <Field
          label="Store name"
          value={orgName}
          onChange={setOrgName}
          hint="You can change this later"
        />
      )}
      {err && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">
          {err}
        </p>
      )}
      <button
        disabled={pending}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1a1a1a] text-[#faf7f2] font-medium disabled:opacity-50"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {mode === "signup" ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-[#1a1a1a]/60">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 w-full px-3 py-2 bg-[#faf7f2] border border-[#1a1a1a]/20 text-sm focus:outline-none focus:border-[#1a1a1a]"
      />
      {hint && <p className="text-xs text-[#1a1a1a]/50 mt-1">{hint}</p>}
    </div>
  );
}
