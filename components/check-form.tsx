import { Search } from "lucide-react";

import { EXAMPLES, INPUT_HINT } from "@/lib/constants";

/**
 * A plain GET form: the result lives at a shareable URL and is rendered on the
 * server, so the page works with JavaScript switched off.
 */
export function CheckForm({ query }: { query: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <form action="/" method="get" className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <label htmlFor="query" className="sr-only">
            A User-Agent string or an IP address
          </label>
          <input
            id="query"
            name="q"
            type="text"
            defaultValue={query}
            placeholder={INPUT_HINT}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-11 pr-4 font-mono text-sm text-slate-900 outline-none transition placeholder:font-sans placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/15"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-teal-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-600/25"
        >
          Check it
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Try</span>
        {EXAMPLES.map((example) => (
          <a
            key={example.label}
            href={`/?q=${encodeURIComponent(example.query)}`}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-teal-400 hover:text-teal-700"
          >
            {example.label}
          </a>
        ))}
        {query ? (
          <a
            href="/"
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-teal-700 underline-offset-2 hover:underline"
          >
            Check me instead
          </a>
        ) : null}
      </div>
    </section>
  );
}
