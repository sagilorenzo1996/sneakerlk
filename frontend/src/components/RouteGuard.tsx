"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const PUBLIC_PATHS = ["/login", "/register"];

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const { token, initialized } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (!initialized) return;
    if (!token && !isPublic) router.replace("/login");
    if (token && isPublic) router.replace("/");
  }, [initialized, token, isPublic, router]);

  // Show spinner while reading localStorage
  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={32} className="animate-spin text-slate-300" />
      </div>
    );
  }

  // Suppress flash while redirect is in-flight
  if (!token && !isPublic) return null;
  if (token && isPublic) return null;

  return <>{children}</>;
}
