"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  MessageSquare,
  Zap,
  Users,
  Building2,
  Tag,
  Layers,
  Star,
  Workflow,
  Settings,
  Store,
  ShoppingBasket,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/workflows", label: "Workflows", icon: Workflow, primary: true },
  { href: "/dashboard/proposals", label: "Proposals", icon: CheckCircle2, primary: true },
  { href: "/dashboard/activity", label: "Activity", icon: BarChart3 },
  { href: "/dashboard/shopify", label: "Shopify", icon: ShoppingBasket },
  { href: "/dashboard/products", label: "Products", icon: Package },
  { href: "/dashboard/orders", label: "Orders", icon: ShoppingCart },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/collections", label: "Collections", icon: Layers },
  { href: "/dashboard/discounts", label: "Discounts", icon: Tag },
  { href: "/dashboard/reviews", label: "Reviews", icon: Star },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/org", label: "Organization", icon: Building2 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/chat", label: "Chat (beta)", icon: MessageSquare },
  { href: "/shop", label: "View Storefront", icon: Store },
];

export function SidebarNav({
  user,
  org,
}: {
  user?: { name: string | null; email: string } | null;
  org?: { id: string; name: string } | null;
}) {
  const pathname = usePathname();

  return (
    <div className="w-56 border-r border-border bg-card flex flex-col h-screen">
      <div className="p-4 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-lg">StorePilot</span>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border">
        {user ? (
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs font-medium truncate">
              {org?.name ?? "No org"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {user.email}
            </p>
            <form action="/api/auth/logout" method="POST" className="mt-2">
              <button className="text-xs text-muted-foreground hover:text-foreground underline">
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
            <p className="text-xs font-medium">Demo mode</p>
            <p className="text-xs text-muted-foreground">
              <Link href="/signup" className="underline">
                Create an account
              </Link>{" "}
              to keep your work.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
