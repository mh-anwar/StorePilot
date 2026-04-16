import Link from "next/link";
import { ShoppingBag, Search, User } from "lucide-react";
import { loadCart } from "@/lib/cart";

export const dynamic = "force-dynamic";

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cart = await loadCart();
  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#1a1a1a] flex flex-col">
      {/* Marquee */}
      <div className="bg-[#1a1a1a] text-[#faf7f2] text-[11px] font-mono uppercase tracking-[0.3em] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 py-2 text-center">
          Free returns · Ships in 1–2 business days · SPRING25 for 25% off
        </div>
      </div>

      <header className="border-b border-[#1a1a1a]/10 bg-[#faf7f2] sticky top-0 z-40 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/shop" className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#1a1a1a] flex items-center justify-center">
                <span className="text-[#faf7f2] font-serif italic text-sm">s</span>
              </div>
              <span className="font-serif text-xl tracking-tight">StorePilot</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-sm">
              <Link href="/shop" className="hover:underline underline-offset-4">All</Link>
              <Link href="/shop?category=Apparel" className="hover:underline underline-offset-4">Apparel</Link>
              <Link href="/shop?category=Electronics" className="hover:underline underline-offset-4">Electronics</Link>
              <Link href="/shop?category=Home+%26+Kitchen" className="hover:underline underline-offset-4">Home</Link>
              <Link href="/shop?category=Beauty" className="hover:underline underline-offset-4">Beauty</Link>
            </nav>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/shop/search" className="p-2 rounded-full hover:bg-[#1a1a1a]/5" aria-label="Search">
              <Search className="h-4 w-4" />
            </Link>
            <Link href="/shop/account" className="p-2 rounded-full hover:bg-[#1a1a1a]/5" aria-label="Account">
              <User className="h-4 w-4" />
            </Link>
            <Link
              href="/shop/cart"
              className="relative ml-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#1a1a1a] text-sm hover:bg-[#1a1a1a] hover:text-[#faf7f2]"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>Bag</span>
              {cart.itemCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-[#b54a23] text-white text-[10px] font-medium">
                  {cart.itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-[#1a1a1a]/10 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
          <div>
            <p className="font-serif text-lg">StorePilot</p>
            <p className="text-[#1a1a1a]/70 mt-2">A demo shop wired to a multi-agent AI backend.</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-[#1a1a1a]/60 mb-2">Shop</p>
            <ul className="space-y-1.5">
              <li><Link href="/shop">All products</Link></li>
              <li><Link href="/shop?category=Apparel">Apparel</Link></li>
              <li><Link href="/shop?category=Electronics">Electronics</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-[#1a1a1a]/60 mb-2">Account</p>
            <ul className="space-y-1.5">
              <li><Link href="/shop/account">Order lookup</Link></li>
              <li><Link href="/shop/cart">Cart</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-[#1a1a1a]/60 mb-2">Under the hood</p>
            <ul className="space-y-1.5">
              <li><Link href="/">About the project</Link></li>
              <li><Link href="/dashboard">Merchant dashboard</Link></li>
              <li><Link href="/chat">AI chat</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[#1a1a1a]/10">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between text-xs font-mono uppercase tracking-wider text-[#1a1a1a]/60">
            <span>© storepilot demo</span>
            <span>made with neon + next</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
