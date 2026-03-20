import { ThreadSidebar } from "@/components/chat/thread-sidebar";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <ThreadSidebar />
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}
