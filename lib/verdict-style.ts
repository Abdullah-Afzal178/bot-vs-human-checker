import type { Verdict } from "@/lib/scoring";

export type VerdictStyle = {
  headline: string;
  summary: string;
  /** Tailwind colour tokens, kept together so the gauge and chips agree. */
  text: string;
  ring: string;
  chipBg: string;
  chipText: string;
  panelBg: string;
  /** Hex for the SVG arc, which cannot take a utility class. */
  stroke: string;
};

const STYLES: Record<Verdict, VerdictStyle> = {
  human: {
    headline: "Looks human",
    summary: "The signals line up with a person using an ordinary browser.",
    text: "text-emerald-700",
    ring: "border-emerald-200",
    chipBg: "bg-emerald-50",
    chipText: "text-emerald-700",
    panelBg: "bg-emerald-50/50",
    stroke: "#059669",
  },
  "likely-human": {
    headline: "Probably human",
    summary: "Mostly consistent with a person, with a detail or two that is not.",
    text: "text-teal-700",
    ring: "border-teal-200",
    chipBg: "bg-teal-50",
    chipText: "text-teal-700",
    panelBg: "bg-teal-50/50",
    stroke: "#0d9488",
  },
  uncertain: {
    headline: "Can't tell",
    summary: "The evidence pulls both ways, or there is too little of it to call.",
    text: "text-amber-700",
    ring: "border-amber-200",
    chipBg: "bg-amber-50",
    chipText: "text-amber-700",
    panelBg: "bg-amber-50/50",
    stroke: "#d97706",
  },
  "likely-bot": {
    headline: "Probably a bot",
    summary: "Several signals point at automation rather than a person.",
    text: "text-orange-700",
    ring: "border-orange-200",
    chipBg: "bg-orange-50",
    chipText: "text-orange-700",
    panelBg: "bg-orange-50/50",
    stroke: "#ea580c",
  },
  bot: {
    headline: "That's a bot",
    summary: "The evidence is one-sided: this is software, not a person.",
    text: "text-rose-700",
    ring: "border-rose-200",
    chipBg: "bg-rose-50",
    chipText: "text-rose-700",
    panelBg: "bg-rose-50/50",
    stroke: "#e11d48",
  },
};

export function styleFor(verdict: Verdict): VerdictStyle {
  return STYLES[verdict];
}
