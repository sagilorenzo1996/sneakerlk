"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, RotateCcw } from "lucide-react";
import {
  scrapeWebsite, processImage, generateCaption, publishPost, getProfile,
} from "@/lib/api";
import type { Product, Language, Platform, Step, Profile } from "@/types";
import InputForm    from "@/components/InputForm";
import ProductCard  from "@/components/ProductCard";
import PostPreview  from "@/components/PostPreview";

const STEPS = ["input", "products", "processing", "preview", "published"] as const;

function StepIndicator({ current }: { current: Step }) {
  const labels: Record<Step, string> = {
    input: "Enter URL", products: "Choose Product",
    processing: "Processing", preview: "Review & Publish", published: "Published!",
  };
  const idx = STEPS.indexOf(current);
  return (
    <div className="mb-8 flex items-center justify-center gap-0">
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
            i < idx ? "bg-brand-600 text-white"
            : i === idx ? "bg-brand-600 text-white ring-4 ring-brand-200"
            : "bg-slate-200 text-slate-500"
          }`}>
            {i < idx ? "✓" : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 w-12 transition-all sm:w-20 ${i < idx ? "bg-brand-600" : "bg-slate-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function RunWorkflowPage() {
  const { id } = useParams<{ id: string }>();
  const profileId = Number(id);

  const [profile,  setProfile]  = useState<Profile | null>(null);
  const [step,     setStep]     = useState<Step>("input");
  const [error,    setError]    = useState("");

  const [scrapeLoading,    setScrapeLoading]    = useState(false);
  const [products,         setProducts]         = useState<Product[]>([]);
  const [siteTheme,        setSiteTheme]        = useState("");
  const [siteTitle,        setSiteTitle]        = useState("");
  const [phone,            setPhone]            = useState("");

  const [selected,         setSelected]         = useState<Product | null>(null);
  const [processingImage,  setProcessingImage]  = useState(false);
  const [compositeUrl,     setCompositeUrl]     = useState("");
  const [imageFilename,    setImageFilename]    = useState("");

  const [caption,          setCaption]          = useState("");
  const [generatingCaption, setGeneratingCaption] = useState(false);

  const [publishing,       setPublishing]       = useState(false);
  const [publishResult,    setPublishResult]    = useState("");

  useEffect(() => {
    getProfile(profileId).then((p) => {
      setProfile(p);
      setPhone(p.contact_number || "");
    });
  }, [profileId]);

  function reset() {
    setStep("input"); setError(""); setProducts([]); setSiteTheme(""); setSiteTitle("");
    setSelected(null); setCompositeUrl(""); setImageFilename(""); setCaption(""); setPublishResult("");
  }

  async function handleScrape(url: string, ph: string) {
    setError(""); setScrapeLoading(true); setPhone(ph);
    try {
      const res = await scrapeWebsite(url, ph, profileId);
      setProducts(res.products); setSiteTheme(res.site_theme); setSiteTitle(res.site_title);
      setStep("products");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || "Failed to scrape website.";
      setError(msg);
    } finally { setScrapeLoading(false); }
  }

  async function handleProcess(product: Product) {
    setError(""); setProcessingImage(true); setStep("processing");
    try {
      const imgRes = await processImage(product, siteTheme, profileId);
      setCompositeUrl(imgRes.composite_image_url);
      setImageFilename(imgRes.image_filename);
      setGeneratingCaption(true);
      const capRes = await generateCaption(product, phone, ["English"], siteTheme, profileId);
      setCaption(capRes.caption);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || "Image processing failed.";
      setError(msg); setStep("products");
    } finally { setProcessingImage(false); setGeneratingCaption(false); setStep("preview"); }
  }

  async function handleRegenerateCaption(languages: Language[]) {
    if (!selected) return;
    setGeneratingCaption(true); setError("");
    try {
      const res = await generateCaption(selected, phone, languages, siteTheme, profileId);
      setCaption(res.caption);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || "Caption generation failed.");
    } finally { setGeneratingCaption(false); }
  }

  async function handlePublish(platforms: Platform[]) {
    setPublishing(true); setError("");
    try {
      const res = await publishPost(imageFilename, caption, platforms, profileId);
      setPublishResult(res.message); setStep("published");
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || "Publishing failed.");
    } finally { setPublishing(false); }
  }

  return (
    <div className="space-y-8">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Link href={`/profiles/${profileId}`} className="btn-secondary px-3 py-2">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manual Post Creator</h1>
          {profile && <p className="text-sm text-slate-500">{profile.name}</p>}
        </div>
      </div>

      <StepIndicator current={step} />

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 animate-fade-in">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-600 text-xs">✕</button>
        </div>
      )}

      {step === "input" && (
        <InputForm
          onSubmit={handleScrape}
          loading={scrapeLoading}
          defaultUrl={profile?.url}
          defaultPhone={profile?.contact_number}
        />
      )}

      {step === "products" && (
        <div className="animate-slide-up space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Found Products</h2>
              <p className="text-sm text-slate-500">
                {products.length} product{products.length !== 1 ? "s" : ""} found. Select one to generate a post.
              </p>
            </div>
            <button onClick={reset} className="btn-secondary text-xs">
              <RotateCcw size={14} /> Start Over
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((p, i) => (
              <ProductCard key={i} product={p} selected={selected === p}
                onSelect={() => setSelected(p)}
                onProcess={() => { setSelected(p); handleProcess(p); }}
                processing={processingImage && selected === p}
              />
            ))}
          </div>
        </div>
      )}

      {step === "processing" && (
        <div className="flex flex-col items-center justify-center gap-6 py-24 animate-fade-in">
          <div className="relative">
            <div className="h-20 w-20 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
            <div className="absolute inset-0 flex items-center justify-center text-2xl">🎨</div>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-800">Creating your post…</p>
            <p className="mt-1 text-sm text-slate-500">
              Removing background → Generating AI backdrop → Compositing → Writing caption
            </p>
          </div>
        </div>
      )}

      {step === "preview" && selected && compositeUrl && (
        <>
          <div className="flex justify-end">
            <button onClick={reset} className="btn-secondary text-xs">
              <RotateCcw size={14} /> Start Over
            </button>
          </div>
          <PostPreview
            key={compositeUrl}
            compositeImageUrl={compositeUrl}
            imageFilename={imageFilename}
            caption={caption}
            product={selected}
            phone={phone}
            siteTheme={siteTheme}
            onRegenerateCaption={handleRegenerateCaption}
            onPublish={handlePublish}
            generatingCaption={generatingCaption}
            publishing={publishing}
          />
        </>
      )}

      {step === "published" && (
        <div className="flex flex-col items-center gap-6 py-24 text-center animate-slide-up">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-5xl shadow-lg">🎉</div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Post Published!</h2>
            <p className="mt-2 text-slate-500">{publishResult}</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-5 py-3 text-sm text-emerald-700">
            <CheckCircle2 size={16} />
            Your post has been submitted to your connected platforms.
          </div>
          <div className="flex gap-3">
            <button onClick={reset} className="btn-primary">
              <RotateCcw size={16} /> Create Another
            </button>
            <Link href={`/profiles/${profileId}`} className="btn-secondary">
              Back to Profile
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
