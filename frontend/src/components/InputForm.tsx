"use client";

import { useState } from "react";
import { Globe, Phone, Search, Loader2 } from "lucide-react";

interface Props {
  onSubmit: (url: string, phone: string) => Promise<void>;
  loading: boolean;
  defaultUrl?: string;
  defaultPhone?: string;
}

export default function InputForm({ onSubmit, loading, defaultUrl, defaultPhone }: Props) {
  const [url, setUrl]     = useState(defaultUrl ?? "");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [errors, setErrors] = useState<{ url?: string; phone?: string }>({});

  function validate(): boolean {
    const newErrors: { url?: string; phone?: string } = {};
    try {
      new URL(url);
    } catch {
      newErrors.url = "Please enter a valid URL (include https://)";
    }
    if (!phone.trim()) {
      newErrors.phone = "Phone number is required for the caption.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(url.trim(), phone.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="card animate-slide-up">
      <h2 className="mb-1 text-lg font-semibold text-slate-800">
        Start Generating Posts
      </h2>
      <p className="mb-6 text-sm text-slate-500">
        Enter your store URL and contact number. We&apos;ll scrape products,
        process images, and generate captions automatically.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* URL */}
        <div>
          <label className="label">Store / Product URL</label>
          <div className="relative">
            <Globe
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourstore.myshopify.com"
              className="input pl-10"
              disabled={loading}
            />
          </div>
          {errors.url && (
            <p className="mt-1.5 text-xs text-red-600">{errors.url}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="label">WhatsApp / Contact Number</label>
          <div className="relative">
            <Phone
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 000 0000"
              className="input pl-10"
              disabled={loading}
            />
          </div>
          {errors.phone && (
            <p className="mt-1.5 text-xs text-red-600">{errors.phone}</p>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Scraping…
            </>
          ) : (
            <>
              <Search size={16} />
              Find Products
            </>
          )}
        </button>
      </div>
    </form>
  );
}
