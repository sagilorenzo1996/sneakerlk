"use client";

import Link from "next/link";
import {
  Building2, Globe, Clock, Zap, CheckCircle, XCircle,
  ChevronRight, AlertCircle,
} from "lucide-react";
import type { Profile } from "@/types";

interface Props {
  profile: Profile;
}

export default function ProfileCard({ profile }: Props) {
  const pending = profile.post_counts["pending"] ?? 0;
  const posted  = profile.post_counts["posted"]  ?? 0;
  const geminiCalls = profile.usage["gemini"] ?? 0;

  return (
    <Link
      href={`/profiles/${profile.id}`}
      className="card group flex flex-col gap-4 transition-all hover:shadow-md hover:border-brand-200"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white font-bold text-lg">
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate">{profile.name}</p>
            <p className="text-xs text-slate-400 truncate">{profile.url}</p>
          </div>
        </div>
        <ChevronRight
          size={16}
          className="shrink-0 text-slate-300 group-hover:text-brand-500 transition-colors"
        />
      </div>

      {/* Description */}
      {profile.description && (
        <p className="text-sm text-slate-500 line-clamp-2">{profile.description}</p>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <StatBadge label="Pending" value={pending} highlight={pending > 0} />
        <StatBadge label="Posted" value={posted} />
        <StatBadge label="Pipelines" value={profile.pipeline_count} />
      </div>

      {/* API keys + usage */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <div className="flex items-center gap-3">
          <KeyStatus label="Gemini" ok={profile.gemini_api_key_set} />
          <KeyStatus label="Composio" ok={profile.composio_api_key_set} />
        </div>
        {geminiCalls > 0 && (
          <span className="text-slate-400">{geminiCalls} API calls this month</span>
        )}
      </div>

      {/* Pending approval alert */}
      {pending > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertCircle size={12} />
          {pending} post{pending > 1 ? "s" : ""} awaiting your approval
        </div>
      )}
    </Link>
  );
}

function StatBadge({ label, value, highlight }: {
  label: string; value: number; highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg px-2 py-1.5 ${highlight ? "bg-amber-50" : "bg-slate-50"}`}>
      <p className={`text-base font-bold ${highlight ? "text-amber-600" : "text-slate-700"}`}>
        {value}
      </p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

function KeyStatus({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className="flex items-center gap-1">
      {ok
        ? <CheckCircle size={11} className="text-emerald-500" />
        : <XCircle size={11} className="text-slate-300" />}
      {label}
    </span>
  );
}
