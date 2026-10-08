import { Fingerprint, Globe2, MonitorSmartphone, Scale, ScrollText } from "lucide-react";

import { BASELINE, groupSignals, type Assessment, type SignalGroup } from "@/lib/scoring";

const GROUPS: Record<SignalGroup, { title: string; blurb: string; icon: typeof Globe2 }> = {
  agent: {
    title: "What it says it is",
    blurb: "The User-Agent string, parsed rather than pattern-matched.",
    icon: Fingerprint,
  },
  network: {
    title: "Where it is coming from",
    blurb: "People browse from consumer lines. Servers answer from datacenters.",
    icon: Globe2,
  },
  headers: {
    title: "What it sends",
    blurb: "Headers a browser always sets, and that scripts often forget.",
    icon: ScrollText,
  },
  browser: {
    title: "What the browser admits",
    blurb: "Read by JavaScript on this page. Automation leaves fingerprints here.",
    icon: MonitorSmartphone,
  },
};

/**
 * Every signal with the weight it contributed, so the score is auditable
 * rather than a number you have to take on faith.
 */
export function EvidenceLedger({ result }: { result: Assessment }) {
  const { signals, score, capReason } = result;
  const grouped = groupSignals(signals);
  const applied = signals.reduce((sum, signal) => sum + signal.weight, 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 px-5 py-4 sm:px-6">
        <h2 className="text-base font-semibold tracking-tight text-slate-950">The evidence</h2>
        <p className="text-sm text-slate-500">
          {signals.length} signal{signals.length === 1 ? "" : "s"}, each with what it added
        </p>
      </header>

      {grouped.map((entry) => {
        const meta = GROUPS[entry.group];
        const Icon = meta.icon;

        return (
          <div key={entry.group} className="border-b border-slate-200 last:border-b-0">
            <div className="flex items-start gap-3 bg-slate-50/70 px-5 py-3 sm:px-6">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{meta.title}</h3>
                <p className="text-xs leading-5 text-slate-500">{meta.blurb}</p>
              </div>
            </div>

            <ul>
              {entry.signals.map((signal) => (
                <li
                  key={signal.id}
                  className="flex flex-wrap items-start gap-x-4 gap-y-1 border-t border-slate-100 px-5 py-3.5 sm:flex-nowrap sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{signal.label}</p>
                    <p className="mt-0.5 break-words font-mono text-xs text-slate-600">
                      {signal.observed}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{signal.note}</p>
                  </div>
                  <WeightChip weight={signal.weight} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
        <p className="text-sm text-slate-600">
          Starting at <span className="font-mono font-semibold text-slate-900">{BASELINE}</span>{" "}
          (knowing nothing), the signals moved it{" "}
          <span className="font-mono font-semibold text-slate-900">
            {applied >= 0 ? "+" : ""}
            {applied}
          </span>
          .
        </p>
        <p className="text-sm text-slate-600">
          Final score{" "}
          <span className="font-mono text-base font-semibold text-slate-950">{score}</span>
        </p>
      </footer>

      {capReason ? (
        <p className="flex items-start gap-2 border-t border-slate-200 bg-amber-50/70 px-5 py-3 text-xs leading-5 text-amber-900 sm:px-6">
          <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
          <span>
            <span className="font-semibold">Held back on purpose.</span> {capReason}
          </span>
        </p>
      ) : null}
    </section>
  );
}

function WeightChip({ weight }: { weight: number }) {
  if (weight === 0) {
    return (
      <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-500">
        0
      </span>
    );
  }

  const bot = weight > 0;

  return (
    <span
      className={`shrink-0 rounded-md px-2 py-1 font-mono text-xs font-semibold ${
        bot ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
      }`}
      title={bot ? "Pushes towards bot" : "Pushes towards human"}
    >
      {bot ? "+" : ""}
      {weight}
    </span>
  );
}
