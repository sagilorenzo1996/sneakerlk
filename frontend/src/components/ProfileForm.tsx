"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export interface ProfileFormData {
  name: string;
  url: string;
  contact_number: string;
  email: string;
  description: string;
  gemini_api_key: string;
  composio_api_key: string;
  ig_user_id: string;
  facebook_page_id: string;
  gemini_model: string;
  image_model: string;
  currency: string;
}

const GEMINI_MODELS = [
  { value: "gemini-2.5-flash",      label: "Gemini 2.5 Flash",      note: "Best price/performance (recommended)" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite", note: "Fastest, lowest cost" },
  { value: "gemini-2.5-pro",        label: "Gemini 2.5 Pro",        note: "Highest quality, higher cost" },
];

const IMAGE_MODELS = [
  { value: "imagen-4.0-generate-001",      label: "Imagen 4",          note: "Best quality — requires paid API tier" },
  { value: "imagen-4.0-fast-generate-001", label: "Imagen 4 Fast",     note: "Faster, lower cost — requires paid API tier" },
  { value: "imagen-4.0-ultra-generate-001", label: "Imagen 4 Ultra",   note: "Highest quality — requires paid API tier" },
  { value: "gemini-2.5-flash",             label: "Gemini 2.5 Flash",  note: "Free tier — lower image quality" },
];

interface Props {
  initial?: Partial<ProfileFormData>;
  geminiSet?: boolean;
  composioSet?: boolean;
  onSubmit: (data: ProfileFormData) => Promise<void>;
  submitLabel?: string;
}

export default function ProfileForm({
  initial = {},
  geminiSet = false,
  composioSet = false,
  onSubmit,
  submitLabel = "Save Profile",
}: Props) {
  const [form, setForm] = useState<ProfileFormData>({
    name:             initial.name             ?? "",
    url:              initial.url              ?? "",
    contact_number:   initial.contact_number   ?? "",
    email:            initial.email            ?? "",
    description:      initial.description      ?? "",
    gemini_api_key:   initial.gemini_api_key   ?? "",
    composio_api_key: initial.composio_api_key ?? "",
    ig_user_id:       initial.ig_user_id       ?? "",
    facebook_page_id: initial.facebook_page_id ?? "",
    gemini_model:     initial.gemini_model     ?? "gemini-2.5-flash",
    image_model:      initial.image_model      ?? "imagen-4.0-generate-001",
    currency:         initial.currency         ?? "",
  });
  const [showGemini,   setShowGemini]   = useState(false);
  const [showComposio, setShowComposio] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");

  function set(field: keyof ProfileFormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.url.trim()) {
      setError("Store name and URL are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onSubmit(form);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(axiosErr?.response?.data?.detail ?? axiosErr?.message ?? "Save failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Store Details */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-slate-800">Store Details</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Store Name *</label>
            <input className="input" value={form.name} onChange={set("name")}
              placeholder="My Shopify Store" required />
          </div>
          <div>
            <label className="label">Store URL *</label>
            <input className="input" type="url" value={form.url} onChange={set("url")}
              placeholder="https://mystore.myshopify.com" required />
          </div>
          <div>
            <label className="label">Contact Number</label>
            <input className="input" type="tel" value={form.contact_number}
              onChange={set("contact_number")} placeholder="+1 234 567 8900" />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email}
              onChange={set("email")} placeholder="store@example.com" />
          </div>
          <div>
            <label className="label">Currency Override</label>
            <input className="input" value={form.currency} onChange={set("currency")}
              placeholder="e.g. LKR, €, Rs." />
            <p className="mt-1 text-xs text-slate-400">
              If set, overrides the currency symbol detected from your store. Leave blank to use the store&apos;s own currency.
            </p>
          </div>
        </div>

        <div>
          <label className="label">Description</label>
          <textarea
            className="input min-h-[80px] resize-none"
            value={form.description}
            onChange={set("description")}
            placeholder="Brief description of what your store sells…"
          />
        </div>
      </div>

      {/* API Keys */}
      <div className="card space-y-4">
        <div>
          <h2 className="font-semibold text-slate-800">API Keys</h2>
          <p className="mt-1 text-sm text-slate-500">
            Keys are stored locally and never shared. Leave blank to keep the existing key.
          </p>
        </div>

        <PasswordField
          label="Gemini API Key"
          value={form.gemini_api_key}
          onChange={set("gemini_api_key")}
          show={showGemini}
          onToggle={() => setShowGemini((v) => !v)}
          placeholder={geminiSet ? "Enter new key to update…" : "AIza…"}
          hint="Used for caption generation and AI background creation."
        />

        <PasswordField
          label="Composio API Key"
          value={form.composio_api_key}
          onChange={set("composio_api_key")}
          show={showComposio}
          onToggle={() => setShowComposio((v) => !v)}
          placeholder={composioSet ? "Enter new key to update…" : "ck_…"}
          hint="Used to publish posts to Facebook & Instagram."
        />

        <div>
          <label className="label">Instagram Business Account ID</label>
          <input
            className="input"
            value={form.ig_user_id}
            onChange={set("ig_user_id")}
            placeholder="e.g. 17841400000000000"
          />
          <p className="mt-1 text-xs text-slate-400">
            Required for Instagram publishing. Find it in Meta Business Suite → Settings → Business Info, or via the Instagram Graph API.
          </p>
        </div>

        <div>
          <label className="label">Facebook Page ID</label>
          <input
            className="input"
            value={form.facebook_page_id}
            onChange={set("facebook_page_id")}
            placeholder="e.g. 123456789012345"
          />
          <p className="mt-1 text-xs text-slate-400">
            Required for Facebook publishing. Find it in your Facebook Page → About → Page transparency, or in Meta Business Suite.
          </p>
        </div>
      </div>

      {/* Model Selection */}
      <div className="card space-y-4">
        <div>
          <h2 className="font-semibold text-slate-800">AI Models</h2>
          <p className="mt-1 text-sm text-slate-500">
            Choose which models to use for caption generation and image creation.
          </p>
        </div>

        <div>
          <label className="label">Caption Model (Gemini)</label>
          <div className="space-y-2">
            {GEMINI_MODELS.map((m) => (
              <label key={m.value} className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all ${
                form.gemini_model === m.value
                  ? "border-brand-300 bg-brand-50"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}>
                <input
                  type="radio"
                  name="gemini_model"
                  value={m.value}
                  checked={form.gemini_model === m.value}
                  onChange={() => setForm((f) => ({ ...f, gemini_model: m.value }))}
                  className="accent-brand-600"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{m.label}</p>
                  <p className="text-xs text-slate-500">{m.note}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Image Generation Model</label>
          <div className="space-y-2">
            {IMAGE_MODELS.map((m) => (
              <label key={m.value} className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all ${
                form.image_model === m.value
                  ? "border-brand-300 bg-brand-50"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}>
                <input
                  type="radio"
                  name="image_model"
                  value={m.value}
                  checked={form.image_model === m.value}
                  onChange={() => setForm((f) => ({ ...f, image_model: m.value }))}
                  className="accent-brand-600"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{m.label}</p>
                  <p className="text-xs text-slate-500">{m.note}</p>
                </div>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-amber-600">
            ⚠ Imagen models require a paid Google AI API tier. If you&apos;re on the free tier, select Gemini 2.0 Flash.
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function PasswordField({
  label, value, onChange, show, onToggle, placeholder, hint,
}: {
  label: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  show: boolean; onToggle: () => void;
  placeholder: string; hint: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          className="input pr-10"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete="off"
        />
        <button type="button" onClick={onToggle} tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}
