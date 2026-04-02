"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Trash2, Loader2, CheckCircle, Settings, FlaskConical } from "lucide-react";
import type { Pipeline } from "@/types";

interface Props {
  pipeline:            Pipeline;
  onRun:               () => Promise<void>;
  onTest:              () => Promise<void>;
  onToggle:            () => Promise<void>;
  onDelete:            () => Promise<void>;
  onConfigure:         () => void;
  onScheduledComplete?: () => void;
}

const scheduleLabel: Record<string, string> = {
  manual: "Manual trigger",
  daily:  "Daily",
  weekly: "Weekly",
};

const TOTAL_STEPS = 5;
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

export default function PipelineCard({ pipeline, onRun, onTest, onToggle, onDelete, onConfigure, onScheduledComplete }: Props) {
  const [wsRunning,   setWsRunning]   = useState(false);
  const [wsStep,      setWsStep]      = useState("");
  const [wsStepIndex, setWsStepIndex] = useState(0);
  const [runPending,  setRunPending]  = useState(false);
  const [testPending, setTestPending] = useState(false);
  const [toggling,    setToggling]    = useState(false);
  const [ran,         setRan]         = useState(false);

  const wsRef         = useRef<WebSocket | null>(null);
  // Track whether we had a manual run in flight when WS fires running=false
  const manualPending = useRef(false);

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/ws/pipeline/${pipeline.id}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as { running: boolean; step: string; step_index: number };
        const wasRunning = wsRunning;
        setWsRunning(msg.running);
        setWsStep(msg.step ?? "");
        setWsStepIndex(msg.step_index ?? 0);
        // If WS transitions to not-running and it wasn't a manual trigger → scheduled run completed
        if (wasRunning && !msg.running && !manualPending.current) {
          onScheduledComplete?.();
        }
      } catch { /* ignore malformed */ }
    };

    ws.onerror = () => { /* silently ignore connection errors */ };

    return () => {
      ws.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.id]);

  async function handleRun() {
    setRunPending(true);
    manualPending.current = true;
    setRan(false);
    try {
      await onRun();
      setRan(true);
      setTimeout(() => setRan(false), 4000);
    } finally {
      setRunPending(false);
      manualPending.current = false;
    }
  }

  async function handleTest() {
    setTestPending(true);
    manualPending.current = true;
    try {
      await onTest();
    } finally {
      setTestPending(false);
      manualPending.current = false;
    }
  }

  async function handleToggle() {
    setToggling(true);
    try { await onToggle(); }
    finally { setToggling(false); }
  }

  const isActive = pipeline.status === "active";
  const isBusy   = wsRunning || runPending || testPending;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-800 truncate">{pipeline.name}</p>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              pipeline.workflow_configured
                ? isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
                : "bg-amber-50 text-amber-700"
            }`}>
              {pipeline.workflow_configured ? (isActive ? "Active" : "Paused") : "Setup required"}
            </span>
            {wsRunning && !runPending && !testPending && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                <Loader2 size={10} className="animate-spin" />
                Running
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {scheduleLabel[pipeline.schedule] ?? pipeline.schedule}
            {pipeline.post_time ? ` · ${pipeline.post_time}` : ""}
            {" · "}
            {pipeline.platforms.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(", ")}
            {" · "}
            {pipeline.languages.join(", ")}
            {pipeline.workflow_configured && pipeline.posts_per_run > 1
              ? ` · ${pipeline.posts_per_run} posts/run`
              : ""}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {pipeline.workflow_configured ? (
            <>
              {/* Run now */}
              <button
                onClick={handleRun}
                disabled={isBusy || !isActive}
                title="Run now — creates pending posts for approval"
                className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {runPending ? <Loader2 size={12} className="animate-spin" /> : ran ? <CheckCircle size={12} /> : <Play size={12} />}
                {runPending ? "Running…" : ran ? "Done!" : "Run"}
              </button>

              {/* Test run */}
              <button
                onClick={handleTest}
                disabled={isBusy || !isActive}
                title="Test run — generates posts without requiring approval"
                className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {testPending ? <Loader2 size={12} className="animate-spin" /> : <FlaskConical size={12} />}
                {testPending ? "Testing…" : "Test"}
              </button>

              {/* Configure */}
              <button onClick={onConfigure} title="Edit workflow"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all">
                <Settings size={14} />
              </button>

              {/* Pause / Resume */}
              <button onClick={handleToggle} disabled={toggling || isBusy}
                title={isActive ? "Pause" : "Resume"}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all disabled:opacity-40">
                {toggling ? <Loader2 size={14} className="animate-spin" /> : isActive ? <Pause size={14} /> : <Play size={14} />}
              </button>
            </>
          ) : (
            <button onClick={onConfigure}
              className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-all">
              <Settings size={12} />
              Configure Workflow
            </button>
          )}

          {/* Delete */}
          <button onClick={onDelete} title="Delete pipeline" disabled={isBusy}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all disabled:opacity-40">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Step status bar — shown for any running state (manual, test, or scheduled) */}
      {wsRunning && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 flex items-center gap-2">
          <Loader2 size={13} className="animate-spin text-brand-500 shrink-0" />
          <p className="text-xs text-slate-600 font-medium">
            {wsStep || "Starting…"}
          </p>
          <div className="ml-auto flex gap-1">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <span key={i} className={`h-1.5 w-4 rounded-full transition-all duration-500 ${
                i <= wsStepIndex ? "bg-brand-400" : "bg-slate-200"
              }`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
