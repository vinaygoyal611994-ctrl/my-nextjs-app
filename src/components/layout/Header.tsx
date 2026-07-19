import { useSession, signOut } from "next-auth/react";
import { Menu, LogOut, User, KeyRound, ChevronDown, Building2, BadgeCheck } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface HeaderProps {
  onMenuClick: () => void;
  title?: string;
}

export function Header({ onMenuClick, title }: HeaderProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = session?.user?.name
    ? session.user.name.trim().split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200 flex items-center justify-between px-4 py-2.5 shadow-sm">
      {/* Left: hamburger + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <Menu size={22} />
        </button>
        {title && <h2 className="text-base font-semibold text-gray-800">{title}</h2>}
      </div>

      {/* Right: account dropdown */}
      {session?.user && (
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all"
          >
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
              {initials}
            </div>
            {/* Name + firm (desktop) */}
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold text-gray-800 leading-tight">{session.user.name}</p>
              <p className="text-xs text-gray-500 leading-tight truncate max-w-[140px]">
                {session.user.role === "malik" ? "मालिक" : "मुनीम"} · {session.user.firmName}
              </p>
            </div>
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>

          {/* Dropdown */}
          {open && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-50">
              {/* Profile header */}
              <div className="px-4 py-4 bg-gradient-to-br from-amber-50 to-orange-50 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white text-sm font-bold shadow">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{session.user.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                        <BadgeCheck size={10} />
                        {session.user.role === "malik" ? "Malik" : "Munim"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-500">
                  <Building2 size={12} className="shrink-0 text-gray-400" />
                  <span className="truncate font-medium text-gray-700">{session.user.firmName}</span>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1.5">
                <Link
                  href="/settings/change-password"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <KeyRound size={15} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">Change Password</p>
                    <p className="text-xs text-gray-400">Update your login password</p>
                  </div>
                </Link>
              </div>

              {/* Logout */}
              <div className="border-t border-gray-100 py-1.5">
                <button
                  onClick={() => { setOpen(false); signOut({ callbackUrl: "/auth/login" }); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                    <LogOut size={15} className="text-red-500" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Logout</p>
                    <p className="text-xs text-red-400">Sign out of your account</p>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
