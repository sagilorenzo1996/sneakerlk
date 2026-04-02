"use client";

import { useState } from "react";
import Image from "next/image";
import { CheckCircle, XCircle, Loader2, ExternalLink, Info } from "lucide-react";
import type { Post } from "@/types";

interface Props {
  post:       Post;
  onApprove?: () => Promise<void>;
  onReject?:  () => Promise<void>;
  onDelete?:  () => Promise<void>;
  onDetails:  (post: Post) => void;
  isTest?:    boolean;
}

const platformLabel: Record<string, string> = {
  facebook:  "Facebook",
  instagram: "Instagram",
};

const CAPTION_PREVIEW_LENGTH = 160;

export default function PostApprovalCard({ post, onApprove, onReject, onDelete, onDetails, isTest }: Props) {
  const [approving,    setApproving]    = useState(false);
  const [rejecting,    setRejecting]    = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [showFullCap,  setShowFullCap]  = useState(false);

  async function handleApprove() {
    setApproving(true);
    try { await onApprove?.(); } finally { setApproving(false); }
  }

  async function handleReject() {
    setRejecting(true);
    try { await onReject?.(); } finally { setRejecting(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    try { await onDelete?.(); } finally { setDeleting(false); }
  }

  const imageUrl = post.image_url.startsWith("http")
    ? post.image_url
    : `http://localhost:8000${post.image_url}`;

  const captionTruncated = post.caption.length > CAPTION_PREVIEW_LENGTH && !showFullCap;
  const captionText = captionTruncated
    ? post.caption.slice(0, CAPTION_PREVIEW_LENGTH) + "…"
    : post.caption;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Image */}
      <div className="relative aspect-square w-full bg-slate-100">
        <Image src={imageUrl} alt={post.product_name} fill className="object-cover"
          sizes="(max-width: 640px) 100vw, 50vw" />
        {isTest && (
          <div className="absolute top-2 left-2 rounded-full bg-violet-600 px-2 py-0.5 text-xs font-semibold text-white">
            Test
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Meta */}
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="font-medium text-slate-800 text-sm truncate">{post.product_name}</p>
            <p className="text-xs text-slate-400">
              {post.platforms.map((p) => platformLabel[p] ?? p).join(", ")}
              {" · "}
              {new Date(post.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {post.product_url && (
              <a href={post.product_url} target="_blank" rel="noopener noreferrer"
                className="text-slate-400 hover:text-brand-600 transition-colors p-1">
                <ExternalLink size={13} />
              </a>
            )}
            <button onClick={() => onDetails(post)}
              title="View details & prompts used"
              className="text-slate-400 hover:text-brand-600 transition-colors p-1">
              <Info size={13} />
            </button>
          </div>
        </div>

        {/* Caption */}
        <div>
          <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
            {captionText}
          </p>
          {post.caption.length > CAPTION_PREVIEW_LENGTH && (
            <button
              onClick={() => setShowFullCap((v) => !v)}
              className="mt-1 text-xs font-medium text-brand-600 hover:underline"
            >
              {showFullCap ? "Show less" : "Show more"}
            </button>
          )}
        </div>

        {/* Actions */}
        {isTest ? (
          <button onClick={handleDelete} disabled={deleting}
            className="btn-danger w-full justify-center py-2 text-xs">
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
            {deleting ? "Deleting…" : "Delete Test"}
          </button>
        ) : (
          <div className="flex gap-2 pt-1">
            <button onClick={handleApprove} disabled={approving || rejecting}
              className="btn-success flex-1 justify-center py-2 text-xs">
              {approving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
              {approving ? "Publishing…" : "Approve & Post"}
            </button>
            <button onClick={handleReject} disabled={approving || rejecting}
              className="btn-danger flex-1 justify-center py-2 text-xs">
              {rejecting ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
              {rejecting ? "Rejecting…" : "Reject"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
