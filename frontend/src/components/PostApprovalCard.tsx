"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { CheckCircle, XCircle, Loader2, ExternalLink, Info, Upload } from "lucide-react";
import type { Post } from "@/types";

interface Props {
  post:             Post;
  onApprove?:       () => Promise<void>;
  onReject?:        () => Promise<void>;
  onDelete?:        () => Promise<void>;
  onDetails:        (post: Post) => void;
  onUploadImage?:   (file: File) => Promise<void>;
  isTest?:          boolean;
}

const platformLabel: Record<string, string> = {
  facebook:  "Facebook",
  instagram: "Instagram",
};

const CAPTION_PREVIEW_LENGTH = 160;

export default function PostApprovalCard({ post, onApprove, onReject, onDelete, onDetails, onUploadImage, isTest }: Props) {
  const [approving,    setApproving]    = useState(false);
  const [rejecting,    setRejecting]    = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [showFullCap,  setShowFullCap]  = useState(false);
  const [localImage,   setLocalImage]   = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onUploadImage) return;
    setUploading(true);
    try {
      setLocalImage(URL.createObjectURL(file)); // optimistic preview
      await onUploadImage(file);
    } catch {
      setLocalImage(null);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const hasImage = !!(localImage || post.image_url);
  const imageUrl = localImage
    ? localImage
    : post.image_url.startsWith("http")
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
        {hasImage ? (
          <Image src={imageUrl} alt={post.product_name} fill className="object-cover"
            sizes="(max-width: 640px) 100vw, 50vw" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
            <Upload size={24} />
            <p className="text-xs font-medium">No image yet</p>
          </div>
        )}
        {isTest && (
          <div className="absolute top-2 left-2 rounded-full bg-violet-600 px-2 py-0.5 text-xs font-semibold text-white">
            Test
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 size={24} className="animate-spin text-brand-500" />
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

        {/* Upload image (user_upload workflow) */}
        {onUploadImage && (
          <>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
              className="hidden" onChange={handleImageFile} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {uploading ? "Uploading…" : hasImage ? "Replace Image" : "Upload Image"}
            </button>
          </>
        )}

        {/* Actions */}
        {isTest ? (
          <button onClick={handleDelete} disabled={deleting}
            className="btn-danger w-full justify-center py-2 text-xs">
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
            {deleting ? "Deleting…" : "Delete Test"}
          </button>
        ) : (
          <div className="flex gap-2 pt-1">
            <button onClick={handleApprove} disabled={approving || rejecting || !hasImage || uploading}
              title={!hasImage ? "Upload an image before publishing" : undefined}
              className="btn-success flex-1 justify-center py-2 text-xs disabled:opacity-40">
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
