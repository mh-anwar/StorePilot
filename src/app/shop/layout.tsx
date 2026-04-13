import Link from "next/link";
import { ShoppingBag, Search, User, Zap } from "lucide-react";
import { loadCart } from "@/lib/cart";

export const dynamic = "force-dynamic";

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cart = await loadCart();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/shop" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold">StorePilot Shop</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/shop" className="hover:text-foreground">All</Link>
            <Link href="/shop?category=Apparel" className="hover:text-foreground">Apparel</Link>
            <Link href="/shop?category=Electronics" className="hover:text-foreground">Electronics</Link>
            <Link href="/shop?category=Home+%26+Kitchen" className="hover:text-foreground">Home</Link>
            <Link href="/shop?category=Beauty" className="hover:text-foreground">Beauty</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/shop/search" className="p-2 rounded hover:bg-muted" aria-label="Search">
              <Search className="h-4 w-4" />
            </Link>
            <Link href="/shop/account" className="p-2 rounded hover:bg-muted" aria-label="Account">
              <User className="h-4 w-4" />
            </Link>
            <Link
              href="/shop/cart"
              className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-sm"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>Cart</span>
              {cart.itemCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-violet-600 text-white text-[10px] font-medium">
                  {cart.itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/60 py-6 text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <span>© StorePilot Demo Shop</span>
          <Link href="/" className="hover:text-foreground">Back to landing</Link>
        </div>
      </footer>
    </div>
  );
}
