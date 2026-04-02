import {
  Key,
  Globe,
  Zap,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";

const geminiSteps = [
  {
    step: 1,
    title: "Go to Google AI Studio",
    detail: "Visit aistudio.google.com and sign in with your Google account.",
  },
  {
    step: 2,
    title: 'Click "Get API Key"',
    detail:
      'In the left sidebar click "Get API key", then "Create API key in new project".',
  },
  {
    step: 3,
    title: "Copy the key",
    detail:
      "Copy the generated key (starts with AIza…). Keep it secret — treat it like a password.",
  },
  {
    step: 4,
    title: "Enable Imagen access (optional but recommended)",
    detail:
      "In Google Cloud Console, enable the Vertex AI / Generative Language API on your project for Imagen 3 background generation.",
  },
  {
    step: 5,
    title: "Paste it in Settings",
    detail:
      "Go to Settings → Gemini API Key, paste the key, and click Save.",
  },
];

const composioSteps = [
  {
    step: 1,
    title: "Create a Composio account",
    detail: "Visit app.composio.dev and sign up for a free account.",
  },
  {
    step: 2,
    title: "Get your API Key",
    detail:
      "After signing in, go to Settings (top-right) → API Keys → Copy your key.",
  },
  {
    step: 3,
    title: "Connect Facebook & Instagram",
    detail:
      "In the Composio dashboard, go to Integrations → search Facebook → click Connect → follow the OAuth flow to grant page posting permissions.",
  },
  {
    step: 4,
    title: "Connect Instagram Business",
    detail:
      "Similarly, search Instagram → connect your Instagram Business account (must be linked to a Facebook Page).",
  },
  {
    step: 5,
    title: "Paste the key in Settings",
    detail: "Go to Settings → Composio API Key, paste it, and click Save.",
  },
];

const faqItems = [
  {
    q: "Why does background removal take a while the first time?",
    a: "rembg downloads an ONNX AI model (~170 MB) on first use. Subsequent runs are fast.",
  },
  {
    q: "Can I use this app with non-Shopify stores?",
    a: "Yes. The scraper uses schema.org markup and CSS heuristics as a fallback for any e-commerce site.",
  },
  {
    q: "The image looks blurry or wrong — what can I do?",
    a: "Try a direct product image URL. Some stores block hotlinking. You can also open the product page directly.",
  },
  {
    q: "Instagram posting fails with a URL error?",
    a: "Meta's API requires a publicly accessible image URL. For local testing, expose your machine with ngrok and update the public base URL.",
  },
  {
    q: "Where are my generated images saved?",
    a: "In backend/static/images/ — you can access them directly at http://localhost:8000/static/images/",
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Setup Guide & Help</h1>
        <p className="mt-2 text-slate-500">
          Everything you need to get SocialAuto running in under 10 minutes.
        </p>
      </div>

      {/* Quick-start checklist */}
      <div className="card border-brand-200 bg-brand-50/40">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-brand-800">
          <Zap size={18} /> Quick-start Checklist
        </h2>
        <ol className="space-y-2 text-sm text-slate-700">
          {[
            "Install Python 3.10+ and Node.js 18+",
            "cd backend && pip install -r requirements.txt",
            "cd backend && uvicorn app.main:app --reload",
            "cd frontend && npm install && npm run dev",
            "Open http://localhost:3000 in your browser",
            "Go to Settings and add your Gemini + Composio API keys",
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs text-white font-bold">
                {i + 1}
              </span>
              <code className="rounded bg-white px-1.5 py-0.5 text-xs font-mono text-slate-800 border border-slate-200">
                {item}
              </code>
            </li>
          ))}
        </ol>
      </div>

      {/* Gemini */}
      <Section
        icon={<Key size={18} />}
        title="How to Get a Gemini API Key"
        color="brand"
        link={{ label: "Open Google AI Studio →", href: "https://aistudio.google.com" }}
        steps={geminiSteps}
      />

      {/* Composio */}
      <Section
        icon={<Globe size={18} />}
        title="How to Get a Composio API Key"
        color="violet"
        link={{ label: "Open Composio Dashboard →", href: "https://app.composio.dev" }}
        steps={composioSteps}
      />

      {/* Note about Instagram */}
      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
        <div>
          <strong>Instagram requirement:</strong> You must have an{" "}
          <em>Instagram Business</em> account linked to a{" "}
          <em>Facebook Page</em>. Personal Instagram accounts cannot use the
          publishing API.
        </div>
      </div>

      {/* FAQ */}
      <div className="card">
        <h2 className="mb-5 font-semibold text-slate-800">FAQ</h2>
        <div className="space-y-4">
          {faqItems.map(({ q, a }, i) => (
            <div key={i}>
              <p className="flex items-start gap-2 font-medium text-slate-800">
                <ChevronRight size={16} className="mt-0.5 shrink-0 text-brand-600" />
                {q}
              </p>
              <p className="ml-6 mt-1 text-sm text-slate-500">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface Step { step: number; title: string; detail: string }

function Section({
  icon,
  title,
  color,
  link,
  steps,
}: {
  icon: React.ReactNode;
  title: string;
  color: "brand" | "violet";
  link: { label: string; href: string };
  steps: Step[];
}) {
  const accent = color === "brand" ? "text-brand-700" : "text-violet-700";
  const bg     = color === "brand" ? "bg-brand-600"  : "bg-violet-600";
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className={`flex items-center gap-2 font-semibold ${accent}`}>
          {icon}
          {title}
        </h2>
        <a
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className={`flex items-center gap-1 text-xs font-medium ${accent} hover:underline`}
        >
          <ExternalLink size={12} />
          {link.label}
        </a>
      </div>
      <ol className="space-y-4">
        {steps.map(({ step, title: t, detail }) => (
          <li key={step} className="flex gap-3">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${bg} text-xs font-bold text-white`}
            >
              {step}
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-800">{t}</p>
              <p className="mt-0.5 text-sm text-slate-500">{detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
