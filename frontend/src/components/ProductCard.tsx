"use client";

import Image from "next/image";
import { ExternalLink, Tag, DollarSign, Wand2 } from "lucide-react";
import type { Product } from "@/types";

interface Props {
  product: Product;
  selected: boolean;
  onSelect: () => void;
  onProcess: () => void;
  processing: boolean;
}

export default function ProductCard({
  product,
  selected,
  onSelect,
  onProcess,
  processing,
}: Props) {
  return (
    <div
      onClick={onSelect}
      className={`group relative cursor-pointer rounded-2xl border-2 p-4 transition-all duration-200 hover:shadow-md ${
        selected
          ? "border-brand-500 bg-brand-50/50 shadow-md"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      {/* Selection indicator */}
      {selected && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-xs text-white font-bold">
          ✓
        </span>
      )}

      {/* Product image */}
      <div className="relative mb-3 h-44 w-full overflow-hidden rounded-xl bg-slate-100">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-contain p-2"
            unoptimized
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            No image
          </div>
        )}
      </div>

      {/* Info */}
      <h3
        className="mb-1 line-clamp-2 text-sm font-semibold text-slate-800"
        title={product.name}
      >
        {product.name}
      </h3>

      <div className="mb-3 flex items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <DollarSign size={12} />
          {product.price}
        </span>
        <a
          href={product.product_url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-brand-600 hover:underline"
        >
          <ExternalLink size={12} />
          View
        </a>
      </div>

      {/* Process button */}
      {selected && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onProcess();
          }}
          disabled={processing}
          className="btn-primary w-full justify-center text-xs"
        >
          <Wand2 size={14} />
          {processing ? "Processing…" : "Generate Post"}
        </button>
      )}
    </div>
  );
}
