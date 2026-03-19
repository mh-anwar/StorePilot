"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Thread {
  id: string;
  title: string | null;
  createdAt: string;
  messageCount: number;
}

export function ThreadSidebar() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/threads")
      .then((r) => r.json())
      .then(setThreads)
      .catch(() => {});
  }, [pathname]);

  const deleteThread = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await fetch(`/api/threads/${id}`, { method: "DELETE" });
    setThreads((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="w-64 border-r border-border bg-muted/30 flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <Link href="/chat">
          <Button variant="outline" className="w-full justify-start gap-2">
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </Link>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {threads.map((thread) => {
            const isActive = pathname === `/chat/${thread.id}`;
            return (
              <Link
                key={thread.id}
                href={`/chat/${thread.id}`}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors group",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <MessageSquare className="h-4 w-4 flex-shrink-0" />
                <span className="truncate flex-1">
                  {thread.title || "Untitled"}
                </span>
                <button
                  onClick={(e) => deleteThread(thread.id, e)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </Link>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
