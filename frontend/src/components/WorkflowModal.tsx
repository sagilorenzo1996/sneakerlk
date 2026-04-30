"use client";

import { useRef, useState } from "react";
import { Loader2, X, Trash2, Upload, Sparkles, ImageUp, Images } from "lucide-react";
import type { Pipeline } from "@/types";
import { uploadReferenceImages, deleteReferenceImage } from "@/lib/api";

const LANGUAGES = ["English", "Arabic", "French", "Spanish", "Hindi", "Portuguese", "German", "Turkish", "Sinhala"];

const DEFAULT_CAPTION_PROMPT = `You are a professional social media marketing copywriter for e-commerce.

Create an engaging Instagram/Facebook post caption for the following product:

- Product Name: {product_name}
- Price: {price}
- Product Link: {product_url}
- Contact Phone: {phone}
- Store Description: {store_description}
- Store Theme/Aesthetic: {site_theme}
- Product Description: {product_description}

Requirements:
1. {language_instruction}
2. Start with an attention-grabbing hook (emoji encouraged).
3. Highlight the product's key benefits based on the description and theme.
4. Include a clear call-to-action (e.g., "Shop now", "Order via WhatsApp").
5. Naturally include the product link: {product_url}
6. Include the contact phone number for orders: {phone}
7. End with 10-15 relevant hashtags.
8. Keep total length under 2200 characters.
9. Make it feel authentic, not robotic.

Return ONLY the caption text, no extra commentary.`;

const DEFAULT_IMAGE_PROMPT = `A high-end, minimalist professional product photography stage. Empty minimalist pedestal setup for a {store_description_hint}. Color Palette: {site_theme}. Lighting: Soft-box studio lighting with elegant shadows and a subtle radial gradient. Texture: Smooth matte surface with a hint of architectural depth. Composition: Perfectly centered, symmetrical, empty space, 8k resolution, clean lines, social media aesthetic. Exclusions: No products, no animals, no people, no text, no logos. 1:1 Aspect Ratio.`;

const BACKEND = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") ?? "http://localhost:8000";

type WorkflowType = "ai_full" | "user_upload" | "reference_images";

const WORKFLOW_OPTIONS: { type: WorkflowType; icon: React.ReactNode; label: string; description: string }[] = [
  {
    type: "ai_full",
    icon: <Sparkles size={18} />,
    label: "AI Generated Images",
    description: "AI scrapes your store, generates a styled background image, and writes the caption automatically.",
  },
  {
    type: "user_upload",
    icon: <ImageUp size={18} />,
    label: "Upload Your Own Images",
    description: "AI scrapes your store and writes captions. You upload an image to each post before publishing.",
  },
  {
    type: "reference_images",
    icon: <Images size={18} />,
    label: "Reference Image Library",
    description: "Upload a set of background images. AI picks one, composites your product onto it, and writes the caption.",
  },
];

interface Props {
  pipeline: Pipeline;
  profileId: number;
  onSave: (updates: {
    workflow_configured: boolean;
    workflow_type: string;
    posts_per_run: number;
    languages: string[];
    caption_prompt: string;
    image_prompt: string;
  }) => Promise<void>;
  onClose: () => void;
}

export default function WorkflowModal({ pipeline, profileId, onSave, onClose }: Props) {
  const [workflowType,   setWorkflowType]   = useState<WorkflowType>((pipeline.workflow_type as WorkflowType) || "ai_full");
  const [postsPerRun,    setPostsPerRun]    = useState(pipeline.posts_per_run || 1);
  const [languages,      setLanguages]      = useState<string[]>(pipeline.languages.length ? pipeline.languages : ["English"]);
  const [captionPrompt,  setCaptionPrompt]  = useState(pipeline.caption_prompt || DEFAULT_CAPTION_PROMPT);
  const [imagePrompt,    setImagePrompt]    = useState(pipeline.image_prompt || DEFAULT_IMAGE_PROMPT);
  const [refImages,      setRefImages]      = useState<string[]>(pipeline.reference_images || []);
  const [uploading,      setUploading]      = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toggleLanguage(lang: string) {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  }

  async function handleUploadRefImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setError("");
    try {
      const result = await uploadReferenceImages(profileId, pipeline.id, files);
      setRefImages(result.filenames);
    } catch {
      setError("Failed to upload reference images.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteRefImage(filename: string) {
    try {
      await deleteReferenceImage(profileId, pipeline.id, filename);
      setRefImages((prev) => prev.filter((f) => f !== filename));
    } catch {
      setError("Failed to delete image.");
    }
  }

  async function handleSave() {
    if (languages.length === 0)    { setError("Select at least one language."); return; }
    if (!captionPrompt.trim())     { setError("Caption prompt cannot be empty."); return; }
    if (workflowType === "ai_full" && !imagePrompt.trim()) { setError("Image prompt cannot be empty."); return; }
    if (workflowType === "reference_images" && refImages.length === 0) {
      setError("Upload at least one reference image."); return;
    }
    setLoading(true);
    setError("");
    try {
      await onSave({
        workflow_configured: true,
        workflow_type: workflowType,
        posts_per_run: postsPerRun,
        languages,
        caption_prompt: captionPrompt,
        image_prompt: workflowType === "ai_full" ? imagePrompt : "",
      });
    } catch {
      setError("Failed to save workflow configuration.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="relative flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl max-h-[90vh]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Configure Workflow</h3>
            <p className="text-sm text-slate-500">{pipeline.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto space-y-6 p-6">

          {/* Workflow type selector */}
          <div>
            <label className="label">Workflow Type</label>
            <p className="mb-3 text-xs text-slate-400">Choose how posts are generated for this pipeline.</p>
            <div className="space-y-2">
              {WORKFLOW_OPTIONS.map(({ type, icon, label, description }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setWorkflowType(type)}
                  className={`w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                    workflowType === type
                      ? "border-brand-300 bg-brand-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <span className={`mt-0.5 shrink-0 ${workflowType === type ? "text-brand-600" : "text-slate-400"}`}>
                    {icon}
                  </span>
                  <div>
                    <p className={`text-sm font-medium ${workflowType === type ? "text-brand-800" : "text-slate-700"}`}>
                      {label}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Posts per run */}
          <div>
            <label className="label">Posts per run</label>
            <p className="mb-2 text-xs text-slate-400">How many products to generate posts for each time the pipeline runs.</p>
            <input
              type="number" min={1} max={10}
              className="input w-28"
              value={postsPerRun}
              onChange={(e) => setPostsPerRun(Math.max(1, Math.min(10, Number(e.target.value))))}
            />
          </div>

          {/* Language */}
          <div>
            <label className="label">Languages</label>
            <p className="mb-2 text-xs text-slate-400">Caption will be written in these languages.</p>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => (
                <button key={lang} type="button" onClick={() => toggleLanguage(lang)}
                  className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition-all ${
                    languages.includes(lang)
                      ? "border-brand-300 bg-brand-50 text-brand-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}>
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* Reference images (reference_images workflow only) */}
          {workflowType === "reference_images" && (
            <div>
              <label className="label">Reference Images</label>
              <p className="mb-3 text-xs text-slate-400">
                Upload background images. Each run picks one randomly and composites your product onto it.
              </p>

              {refImages.length > 0 && (
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {refImages.map((filename) => (
                    <div key={filename} className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-square bg-slate-50">
                      <img
                        src={`${BACKEND}/static/ref_images/${pipeline.id}/${filename}`}
                        alt={filename}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => handleDeleteRefImage(filename)}
                        className="absolute top-1 right-1 rounded-full bg-red-600 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleUploadRefImages}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 w-full justify-center"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? "Uploading…" : "Upload reference images"}
              </button>
            </div>
          )}

          {/* Caption prompt */}
          <div>
            <label className="label">Caption Prompt</label>
            <p className="mb-2 text-xs text-slate-400">
              Sent to Gemini to generate the post caption. Available variables:{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">{"{product_name}"}</code>{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">{"{price}"}</code>{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">{"{product_url}"}</code>{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">{"{phone}"}</code>{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">{"{site_theme}"}</code>{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">{"{store_description}"}</code>{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">{"{product_description}"}</code>{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">{"{language_instruction}"}</code>
            </p>
            <textarea
              className="input min-h-[200px] resize-y font-mono text-xs"
              value={captionPrompt}
              onChange={(e) => setCaptionPrompt(e.target.value)}
            />
          </div>

          {/* Image prompt (ai_full only) */}
          {workflowType === "ai_full" && (
            <div>
              <label className="label">Image Generation Prompt</label>
              <p className="mb-2 text-xs text-slate-400">
                Sent to Imagen to generate the background image. Available variables:{" "}
                <code className="rounded bg-slate-100 px-1 text-xs">{"{site_theme}"}</code>{" "}
                <code className="rounded bg-slate-100 px-1 text-xs">{"{store_type}"}</code>{" "}
                <code className="rounded bg-slate-100 px-1 text-xs">{"{store_description}"}</code>{" "}
                <code className="rounded bg-slate-100 px-1 text-xs">{"{store_description_hint}"}</code>{" "}
                <code className="rounded bg-slate-100 px-1 text-xs">{"{product_name}"}</code>{" "}
                <code className="rounded bg-slate-100 px-1 text-xs">{"{price}"}</code>
              </p>
              <textarea
                className="input min-h-[80px] resize-y font-mono text-xs"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
              />
            </div>
          )}

          {workflowType === "user_upload" && (
            <div className="rounded-lg bg-blue-50 px-4 py-3 text-xs text-blue-700 space-y-1">
              <p className="font-medium">How user upload works</p>
              <p>After the pipeline runs, each pending post will have an <strong>Upload Image</strong> button in the approval queue. Upload your image before approving and publishing.</p>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleSave} disabled={loading || uploading} className="btn-primary flex-1 justify-center">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Saving…" : "Save Workflow"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
