"use client";

import { X, ExternalLink } from "lucide-react";
import type { Post } from "@/types";

interface Props {
  post:    Post;
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h4>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-36 shrink-0 text-slate-400">{label}</span>
      <span className="text-slate-700 break-all">{value}</span>
    </div>
  );
}

export default function PostDetailsModal({ post, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="relative flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl max-h-[90vh]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Post Details</h3>
            <p className="text-sm text-slate-500 truncate">{post.product_name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto space-y-6 p-6">
          {/* Product variables */}
          <Section title="Product Variables Used">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2">
              <Field label="Product Name"  value={post.product_name} />
              <Field label="Product URL"   value={post.product_url} />
              <Field label="Description"   value={post.product_description} />
              <Field label="Platforms"     value={post.platforms.join(", ")} />
              <Field label="Created"       value={new Date(post.created_at).toLocaleString()} />
              {post.product_url && (
                <a href={post.product_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline mt-1">
                  <ExternalLink size={11} /> Open product page
                </a>
              )}
            </div>
          </Section>

          {/* Caption prompt */}
          <Section title="Caption Prompt Sent to Gemini">
            {post.caption_prompt_used ? (
              <pre className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
                {post.caption_prompt_used}
              </pre>
            ) : (
              <p className="text-sm text-slate-400 italic">Default prompt was used (not stored on this post).</p>
            )}
          </Section>

          {/* Image prompt */}
          <Section title="Image Generation Prompt">
            {post.image_prompt_used ? (
              <pre className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
                {post.image_prompt_used}
              </pre>
            ) : (
              <p className="text-sm text-slate-400 italic">Default prompt was used (not stored on this post).</p>
            )}
          </Section>

          {/* Full caption */}
          <Section title="Generated Caption">
            <pre className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
              {post.caption}
            </pre>
          </Section>
        </div>
      </div>
    </div>
  );
}
