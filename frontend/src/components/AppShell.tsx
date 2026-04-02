"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import RouteGuard from "@/components/RouteGuard";

const AUTH_PATHS = ["/login", "/register"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PATHS.includes(pathname);

  return (
    <>
      {!isAuthPage && <Navbar />}
      <RouteGuard>
        {isAuthPage ? (
          children
        ) : (
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        )}
      </RouteGuard>
    </>
  );
}
