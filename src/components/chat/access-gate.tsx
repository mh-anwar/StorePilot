"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, ArrowRight, AlertCircle } from "lucide-react";

interface AccessGateProps {
  onAuthenticated: (code: string) => void;
}

export function AccessGate({ onAuthenticated }: AccessGateProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!code.trim()) return;

      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: code.trim() }),
        });

        if (res.ok) {
          localStorage.setItem("sp-access-code", code.trim());
          onAuthenticated(code.trim());
        } else {
          setError("Invalid access code. Please try again.");
        }
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [code, onAuthenticated]
  );

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-3">
            <Lock className="h-5 w-5 text-violet-400" />
          </div>
          <CardTitle className="text-lg">Enter Access Code</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            The AI chat requires an access code to prevent unauthorized usage.
            The dashboard is freely accessible.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="password"
              placeholder="Access code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              className="bg-muted/50"
            />
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                {error}
              </div>
            )}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-700 hover:to-cyan-700 gap-2"
              disabled={!code.trim() || loading}
            >
              {loading ? "Verifying..." : "Continue"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
