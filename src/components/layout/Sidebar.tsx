import Link from "next/link";
import { useRouter } from "next/router";
import { cn } from "@/lib/utils";
import {
  BookOpen, ShoppingCart, Store, Package, ArrowLeftRight, Warehouse,
  FileText, Receipt, BarChart2, Settings, Home, X, Coins, Users, Layers, Landmark
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/khata", label: "Account Book (खाता)", icon: BookOpen },
  { href: "/accounts", label: "All Accounts (सभी खाते)", icon: Layers },
  { href: "/kharid", label: "Purchase (खरीद)", icon: ShoppingCart },
  { href: "/kharid/trader", label: "Trader Purchase (व्यापारी खरीद)", icon: Package },
  { href: "/bikri", label: "Sale (बिक्री)", icon: Store },
  { href: "/jama-naame", label: "Receipt / Payment", icon: ArrowLeftRight },
  { href: "/uchanti", label: "Advance (उछंती)", icon: Coins },
  { href: "/staff", label: "Staff & Salary (कर्मचारी)", icon: Users },
  { href: "/godown", label: "Warehouse (गोदाम)", icon: Warehouse },
  { href: "/roznamcha", label: "Daybook (रोजनामचा)", icon: FileText },
  { href: "/kharcha", label: "Expense (खर्चा)", icon: Receipt },
  { href: "/hammali", label: "Hammali Payment (हम्माली)", icon: Users },
  { href: "/sarkar-dues", label: "Sarkar Dues (सरकारी देय)", icon: Landmark },
  { href: "/hisaab-kitab", label: "Reports (हिसाब-किताब)", icon: BarChart2 },
  { href: "/settings", label: "Settings (दुकान)", icon: Settings },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const router = useRouter();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-64 bg-amber-900 text-amber-50 flex flex-col transition-transform duration-200 ease-in-out",
          "lg:translate-x-0 lg:static lg:z-auto",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-amber-700">
          <Link href="/" onClick={onClose}>
            <h1 className="text-lg font-bold tracking-tight hover:text-amber-300 transition-colors">Digital Viyapar</h1>
            <p className="text-xs text-amber-300">Mandi Accounting Software</p>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden text-amber-300 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          {navItems.map((item) => {
            const active =
              item.href === "/dashboard"
                ? router.pathname === "/dashboard"
                : router.pathname === item.href ||
                  (router.pathname.startsWith(item.href + "/") &&
                    !navItems.some(
                      (other) =>
                        other.href !== item.href &&
                        other.href.startsWith(item.href) &&
                        router.pathname.startsWith(other.href)
                    ));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-amber-700 text-white"
                    : "text-amber-200 hover:bg-amber-800 hover:text-white"
                )}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-amber-700 text-xs text-amber-400">
          खैरथल मंडी — v1.2
        </div>
      </aside>
    </>
  );
}
