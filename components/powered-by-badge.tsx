import { POWERED_BY_URL } from "@/lib/constants";

export function PoweredByBadge({ className }: { className?: string }) {
  return (
    <a
      href={POWERED_BY_URL}
      target="_blank"
      rel="noreferrer"
      className={[
        "inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3.5 py-2 text-xs font-medium text-teal-800 transition hover:border-teal-400 hover:text-teal-900",
        className ?? "",
      ].join(" ")}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-500" aria-hidden="true" />
      Powered by ipgeolocation.io
    </a>
  );
}
