"use client";

import { useState } from "react";
import { Eye, EyeOff, Save, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { saveSettings } from "@/lib/api";

interface Props {
  geminiSet: boolean;
  composioSet: boolean;
  onSaved: (geminiSet: boolean, composioSet: boolean) => void;
}

export default function ApiKeyForm({ geminiSet, composioSet, onSaved }: Props) {
  const [geminiKey,  setGeminiKey]  = useState("");
  const [composioKey, setComposioKey] = useState("");
  const [showGemini,  setShowGemini]  = useState(false);
  const [showComposio, setShowComposio] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [message, setMessage]       = useState("");
  const [error, setError]           = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!geminiKey && !composioKey) {
      setError("Enter at least one API key to save.");
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await saveSettings(
        geminiKey  || undefined,
        composioKey || undefined,
      );
      setMessage(res.message);
      onSaved(res.gemini_api_key_set, res.composio_api_key_set);
      setGeminiKey("");
      setComposioKey("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save settings.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="card space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">API Key Management</h2>
        <p className="mt-1 text-sm text-slate-500">
          Keys are stored locally on your machine — never sent to a third party.
        </p>
      </div>

      {/* Gemini Key */}
      <KeyField
        label="Gemini API Key"
        status={geminiSet}
        value={geminiKey}
        show={showGemini}
        onChange={setGeminiKey}
        onToggleShow={() => setShowGemini((v) => !v)}
        placeholder="AIza…"
        hint="Used for caption generation and AI background creation (Imagen 3)."
      />

      {/* Composio Key */}
      <KeyField
        label="Composio API Key"
        status={composioSet}
        value={composioKey}
        show={showComposio}
        onChange={setComposioKey}
        onToggleShow={() => setShowComposio((v) => !v)}
        placeholder="ck_…"
        hint="Used to publish posts to Facebook & Instagram via Composio."
      />

      {/* Feedback */}
      {message && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle size={16} />
          {message}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <XCircle size={16} />
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? "Saving…" : "Save Keys"}
        </button>
      </div>
    </form>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────

interface KeyFieldProps {
  label: string;
  status: boolean;
  value: string;
  show: boolean;
  onChange: (v: string) => void;
  onToggleShow: () => void;
  placeholder: string;
  hint: string;
}

function KeyField({
  label, status, value, show, onChange, onToggleShow, placeholder, hint,
}: KeyFieldProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="label mb-0">{label}</label>
        {status ? (
          <span className="badge-success"><CheckCircle size={11} /> Configured</span>
        ) : (
          <span className="badge-warning"><XCircle size={11} /> Not set</span>
        )}
      </div>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={status ? "Enter new key to update…" : placeholder}
          className="input pr-10"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={onToggleShow}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}
