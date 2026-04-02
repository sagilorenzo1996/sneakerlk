"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Megaphone, HelpCircle, LogOut } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/context/AuthContext";

const navLinks = [
  { href: "/",         label: "Dashboard", icon: Megaphone  },
  { href: "/help",     label: "Help",       icon: HelpCircle },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { email, logout } = useAuth();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md">
            <Megaphone size={18} />
          </div>
          <span className="hidden font-bold text-slate-800 sm:block">SocialAuto</span>
        </Link>

        {/* Nav Links */}
        <div className="flex items-center gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </div>

        {/* User + Logout */}
        <div className="flex items-center gap-3">
          {email && (
            <span className="hidden text-sm text-slate-500 sm:block">{email}</span>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900"
            title="Sign out"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
