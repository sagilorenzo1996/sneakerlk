"use client";

import { Check } from "lucide-react";
import clsx from "clsx";
import type { Language } from "@/types";

const ALL_LANGUAGES: Language[] = [
  "English",
  "Arabic",
  "French",
  "Spanish",
  "Hindi",
  "Portuguese",
  "German",
  "Turkish",
];

interface Props {
  selected: Language[];
  onChange: (langs: Language[]) => void;
  disabled?: boolean;
}

export default function LanguageSelector({ selected, onChange, disabled }: Props) {
  function toggle(lang: Language) {
    if (disabled) return;
    if (selected.includes(lang)) {
      onChange(selected.filter((l) => l !== lang));
    } else {
      onChange([...selected, lang]);
    }
  }

  return (
    <div>
      <p className="label">Caption Language(s)</p>
      <div className="flex flex-wrap gap-2">
        {ALL_LANGUAGES.map((lang) => {
          const active = selected.includes(lang);
          return (
            <button
              key={lang}
              type="button"
              onClick={() => toggle(lang)}
              disabled={disabled}
              className={clsx(
                "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                active
                  ? "border-brand-500 bg-brand-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              {active && <Check size={11} />}
              {lang}
            </button>
          );
        })}
      </div>
      {selected.length === 0 && (
        <p className="mt-1.5 text-xs text-amber-600">
          Select at least one language.
        </p>
      )}
    </div>
  );
}
