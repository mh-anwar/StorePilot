import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#faf7f2] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="block text-center mb-8">
          <span className="font-serif text-2xl tracking-tight">StorePilot</span>
        </Link>
        <div className="bg-white border border-[#1a1a1a]/10 p-8">
          <h1 className="font-serif text-3xl mb-2">Welcome back</h1>
          <p className="text-sm text-[#1a1a1a]/60 mb-6">
            Sign in to your StorePilot account.
          </p>
          <AuthForm mode="login" />
          <p className="text-xs text-[#1a1a1a]/60 mt-6 text-center">
            No account?{" "}
            <Link href="/signup" className="underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
