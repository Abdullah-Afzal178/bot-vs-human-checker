import { AlertTriangle, Info, Radar } from "lucide-react";

import { BrowserProbe } from "@/components/browser-probe";
import { CheckForm } from "@/components/check-form";
import { EvidenceLedger } from "@/components/evidence-ledger";
import { PoweredByBadge } from "@/components/powered-by-badge";
import { VerdictGauge } from "@/components/verdict-gauge";
import { MAX_INPUT } from "@/lib/input";
import { PAGE_TITLE } from "@/lib/constants";
import { inspect } from "@/lib/detect";
import { assess } from "@/lib/scoring";
import { decodeSignals } from "@/lib/signal-codec";
import { styleFor } from "@/lib/verdict-style";

export const dynamic = "force-dynamic";

type RawParams = Record<string, string | string[] | undefined>;

/**
 * Everything is awaited here rather than streamed through <Suspense>. React's
 * out-of-order streaming leaves the real content in a hidden element until a
 * client script reveals it, so with JavaScript off a visitor would see nothing
 * but the loading state — and a crawler with no JavaScript is exactly the
 * visitor this page exists to deliver a verdict about.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const query = first(params.q).slice(0, MAX_INPUT);
  const encodedSignals = first(params.js);
  const selfCheck = query === "";
  const probing = selfCheck && encodedSignals === "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            {PAGE_TITLE}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
            Person or machine? Here is the verdict, and every signal that produced it — with
            the weight each one carried.
          </p>
        </div>
        <PoweredByBadge className="shrink-0" />
      </header>

      <div className="mt-7 space-y-5">
        <Result query={query} encodedSignals={encodedSignals} />
        <CheckForm query={query} />
      </div>

      <Explainer />

      {/*
        Only probe when judging the visitor. A pasted string is not this
        browser, so collecting signals about this browser would be misleading.
      */}
      {probing ? <BrowserProbe query={query} /> : null}
    </div>
  );
}

async function Result({
  query,
  encodedSignals,
}: {
  query: string;
  encodedSignals: string;
}) {
  const subject = await inspect(query);
  const browser = query === "" ? decodeSignals(encodedSignals) : null;
  const observations = { ...subject.observations, browser };
  const result = assess(observations);
  const style = styleFor(result.verdict);
  const selfCheck = query === "";
  const probing = selfCheck && encodedSignals === "";

  return (
    <>
      <section className={`rounded-2xl border bg-white ${style.ring}`}>
        <div className={`flex flex-col items-center gap-6 rounded-t-2xl px-5 py-7 sm:flex-row sm:px-8 ${style.panelBg}`}>
          <VerdictGauge score={result.score} verdict={result.verdict} />

          <div className="min-w-0 text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
              {selfCheck ? "This visitor" : "The subject"}
            </p>
            <h2 className={`mt-1.5 text-3xl font-semibold tracking-tight ${style.text}`}>
              {style.headline}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{style.summary}</p>

            {selfCheck ? null : (
              <p className="mt-3 break-words rounded-lg bg-white/70 px-3 py-2 font-mono text-xs text-slate-700">
                {subject.title}
              </p>
            )}
          </div>
        </div>

        {selfCheck && !browser ? (
          <p className="flex items-start gap-2 border-t border-slate-200 px-5 py-3 text-xs leading-5 text-slate-600 sm:px-8">
            {probing ? (
              <>
                <Radar className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-pulse text-teal-600" />
                <span>
                  This is the verdict from your request alone. The page is reading your
                  browser now and will refresh itself with what it finds.
                </span>
              </>
            ) : (
              <>
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />
                <span>
                  No browser signals arrived, so this verdict rests on the request alone —
                  which is exactly what a crawler looks like. With JavaScript on, this page
                  refreshes itself with them.
                </span>
              </>
            )}
          </p>
        ) : null}

        {subject.notes.map((note) => (
          <p
            key={note}
            className="flex items-start gap-2 border-t border-slate-200 px-5 py-3 text-xs leading-5 text-amber-900 sm:px-8"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            {note}
          </p>
        ))}
      </section>

      <EvidenceLedger result={result} />
    </>
  );
}

function Explainer() {
  const notes = [
    {
      question: "Is this how real bot detection works?",
      answer:
        "It is the honest half of it. Production systems use these same signals, plus behavioural timing, challenge responses, and reputation data built from traffic across many sites. What they do not do is show you their reasoning.",
    },
    {
      question: "Why am I scored as a bot on a VPN?",
      answer:
        "A VPN exit sits in a datacenter, which is genuinely weaker evidence of a person. It costs you points but should not convict you on its own — the browser signals are weighted to outvote it.",
    },
    {
      question: "Can a determined bot pass this?",
      answer:
        "Yes. Every client-side signal here can be patched by a well-built automation stack, and the User-Agent is just a string anyone can set. The network and header checks are harder to fake, which is why they still count.",
    },
    {
      question: "Why does Googlebot score so high?",
      answer:
        "Because it is a bot, and says so. Scoring high is not an accusation — well-behaved crawlers identify themselves deliberately so you can treat them differently from traffic that hides.",
    },
  ];

  return (
    <section className="mt-10 border-t border-slate-200 pt-8">
      <h2 className="text-lg font-semibold tracking-tight text-slate-950">Reading the score</h2>
      <dl className="mt-5 grid gap-x-10 gap-y-6 sm:grid-cols-2">
        {notes.map((note) => (
          <div key={note.question}>
            <dt className="text-sm font-semibold text-slate-900">{note.question}</dt>
            <dd className="mt-1.5 text-sm leading-6 text-slate-600">{note.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return (value ?? "").trim();
}
