import Link from "next/link";
import { ThreadSidebar } from "@/components/chat/thread-sidebar";
import { Zap, LayoutDashboard, Home } from "lucide-react";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <ThreadSidebar />
      <div className="flex-1 flex flex-col">
        <div className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2 text-sm font-semibold hover:opacity-80 transition-opacity">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center">
                <Zap className="h-3 w-3 text-white" />
              </div>
              StorePilot
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/"
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors flex items-center gap-1.5"
            >
              <Home className="h-3.5 w-3.5" />
              Home
            </Link>
            <Link
              href="/dashboard"
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors flex items-center gap-1.5"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Dashboard
            </Link>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
