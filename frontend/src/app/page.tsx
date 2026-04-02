"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Loader2, Store } from "lucide-react";
import { getProfiles } from "@/lib/api";
import type { Profile } from "@/types";
import ProfileCard from "@/components/ProfileCard";

export default function DashboardPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  useEffect(() => {
    getProfiles()
      .then(setProfiles)
      .catch(() => setError("Failed to load profiles."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Your Profiles</h1>
          <p className="mt-1 text-slate-500">
            Manage your store profiles and automated posting pipelines.
          </p>
        </div>
        <Link href="/profiles/new" className="btn-primary">
          <Plus size={16} />
          New Profile
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center gap-3 py-16 justify-center text-slate-400">
          <Loader2 size={20} className="animate-spin" />
          Loading profiles…
        </div>
      ) : error ? (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>
      ) : profiles.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((p) => (
            <ProfileCard key={p.id} profile={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-5 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
        <Store size={28} className="text-slate-400" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-slate-800">No profiles yet</h2>
        <p className="mt-2 text-slate-500 max-w-sm">
          Create your first store profile to start setting up automated social media posting.
        </p>
      </div>
      <Link href="/profiles/new" className="btn-primary">
        <Plus size={16} />
        Create your first profile
      </Link>
    </div>
  );
}
