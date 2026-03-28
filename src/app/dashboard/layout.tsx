import { SidebarNav } from "@/components/dashboard/sidebar-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <SidebarNav />
      <div className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
