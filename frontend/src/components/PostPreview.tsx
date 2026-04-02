"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Send,
  RefreshCw,
  Copy,
  Check,
  Facebook,
  Instagram,
  Loader2,
  MessageSquare,
} from "lucide-react";
import clsx from "clsx";
import type { Language, Platform, Product } from "@/types";
import LanguageSelector from "./LanguageSelector";

interface Props {
  compositeImageUrl: string;
  imageFilename: string;
  caption: string;
  product: Product;
  phone: string;
  siteTheme: string;
  onRegenerateCaption: (languages: Language[]) => Promise<void>;
  onPublish: (platforms: Platform[]) => Promise<void>;
  generatingCaption: boolean;
  publishing: boolean;
}

const PLATFORM_OPTIONS: { id: Platform; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { id: "facebook",  label: "Facebook",  Icon: Facebook  },
  { id: "instagram", label: "Instagram", Icon: Instagram },
];

export default function PostPreview({
  compositeImageUrl,
  imageFilename,
  caption,
  product,
  phone,
  siteTheme,
  onRegenerateCaption,
  onPublish,
  generatingCaption,
  publishing,
}: Props) {
  const [editedCaption, setEditedCaption] = useState(caption);
  const [languages, setLanguages]         = useState<Language[]>(["English"]);
  const [platforms, setPlatforms]         = useState<Platform[]>(["facebook", "instagram"]);
  const [copied, setCopied]               = useState(false);

  // Keep editedCaption in sync when parent re-generates
  // (controlled externally via key prop on the parent)
  if (caption !== editedCaption && !generatingCaption) {
    // Only sync when the parent pushes a fresh caption
    // (avoid overwriting user edits mid-session)
  }

  function togglePlatform(p: Platform) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(editedCaption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const imageFullUrl = compositeImageUrl.startsWith("http")
    ? compositeImageUrl
    : `http://localhost:8000${compositeImageUrl}`;

  return (
    <div className="animate-slide-up space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Post Preview</h2>
        <span className="badge-success">Ready to publish</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Left: Composite Image ─────────────────────────── */}
        <div className="card flex flex-col items-center">
          <p className="mb-3 self-start text-sm font-medium text-slate-600">
            Generated Image (1080×1080)
          </p>
          <div className="relative h-80 w-80 overflow-hidden rounded-2xl border border-slate-200 shadow-lg">
            <Image
              src={imageFullUrl}
              alt={`Post for ${product.name}`}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <p className="mt-3 text-center text-xs text-slate-400">
            {product.name} · {product.price}
          </p>
        </div>

        {/* ── Right: Caption + Controls ─────────────────────── */}
        <div className="flex flex-col gap-5">
          {/* Caption Editor */}
          <div className="card flex-1">
            <div className="mb-2 flex items-center justify-between">
              <label className="label mb-0 flex items-center gap-1.5">
                <MessageSquare size={14} />
                Caption
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="btn-secondary py-1.5 px-3 text-xs"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <textarea
              value={editedCaption}
              onChange={(e) => setEditedCaption(e.target.value)}
              rows={10}
              className="input resize-none font-mono text-xs leading-relaxed"
              placeholder="Caption will appear here…"
            />
          </div>

          {/* Language Selector + Regenerate */}
          <div className="card">
            <LanguageSelector
              selected={languages}
              onChange={setLanguages}
              disabled={generatingCaption}
            />
            <button
              type="button"
              onClick={() => onRegenerateCaption(languages)}
              disabled={generatingCaption || languages.length === 0}
              className="btn-secondary mt-3 w-full justify-center text-xs"
            >
              {generatingCaption ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              {generatingCaption ? "Generating…" : "Regenerate Caption"}
            </button>
          </div>

          {/* Platform Selection */}
          <div className="card">
            <p className="label mb-3">Publish To</p>
            <div className="flex gap-3">
              {PLATFORM_OPTIONS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => togglePlatform(id)}
                  disabled={publishing}
                  className={clsx(
                    "flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-medium transition-all",
                    platforms.includes(id)
                      ? id === "facebook"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-pink-500 bg-pink-50 text-pink-700"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                  )}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
            </div>

            {/* Publish Button */}
            <button
              type="button"
              onClick={() => onPublish(platforms)}
              disabled={publishing || platforms.length === 0}
              className="btn-success mt-4 w-full justify-center"
            >
              {publishing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Publishing…
                </>
              ) : (
                <>
                  <Send size={16} />
                  Approve &amp; Publish
                </>
              )}
            </button>
            {platforms.length === 0 && (
              <p className="mt-2 text-center text-xs text-amber-600">
                Select at least one platform.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
