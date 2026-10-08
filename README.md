# Bot vs Human Checker

Person or machine? Open the page and get a verdict about yourself — or paste any User-Agent string or IP address and get one about them. Every signal that produced the score is shown, with the weight it carried. Powered by [ipgeolocation.io](https://ipgeolocation.io).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built with Next.js](https://img.shields.io/badge/Built%20with-Next.js-000?logo=nextdotjs)](https://nextjs.org/)
[![Powered by ipgeolocation.io](https://img.shields.io/badge/Powered%20by-ipgeolocation.io-0d9488)](https://ipgeolocation.io)

<!-- Add a screenshot of the tool running locally at ./public/tool.png and reference it here -->

---

## What It Does

A score from 0 to 100 — 0 is certainly a person, 100 is certainly a machine — assembled from four groups of evidence, each one listed with the points it added or removed.

| Input | Example | What gets judged |
|---|---|---|
| **Nothing** | *leave the box empty* | You: your request, your network, and what your browser admits |
| **A User-Agent** | `curl/8.5.0` | What the string claims to be |
| **An IP address** | `3.80.0.1` | The network it sits on |

### The four groups

| Group | Signals |
|---|---|
| **What it says it is** | The User-Agent, parsed rather than pattern-matched: declared crawlers, automation markers, browsers, and unrecognised clients |
| **Where it comes from** | Datacenter vs consumer ISP, the reported connection type, anycast and CDN ranges |
| **What it sends** | `Accept-Language`, `Accept`, and whether client hints agree with the User-Agent |
| **What the browser admits** | `navigator.webdriver`, software GPU renderers, empty language lists, the Permissions API contradiction, a missing `window.chrome`, screen size, and whether anything on the page actually moved |

---

## Design notes

Three decisions that are worth explaining, because each one fixes a way this kind of tool usually lies:

**Partial evidence cannot produce a confident answer.** An AWS address with nothing else known is a reason to look closer, not a conviction — plenty of people browse from datacenters and plenty of bots run from bedrooms. So how far the score may travel from its starting point depends on what was actually available: an address alone may move it 25 points, a bare User-Agent 40, a full visitor check the whole 50. When that limit binds, the page says so instead of quietly presenting a capped number as a confident one.

**An absence is only evidence when something could have been present.** A live request that sends no `User-Agent` is suspicious. An IP address was never going to have one, and a pasted string has no headers and no browser. Each of those is skipped rather than scored, so a lookup is not punished for being a lookup.

**The verdict is server-rendered, with no streaming boundary.** React's out-of-order streaming leaves content inside a hidden element until a client script reveals it — so with JavaScript off, a visitor would see a loading skeleton and never the verdict. A crawler with no JavaScript is exactly the visitor this page exists to judge, so everything is awaited and sent in document order.

The browser signals reach the server through a single compact query parameter, written by a plain inline script. That keeps scoring in one place rather than duplicating it client-side — and the script not running is itself the measurement, since a crawler that ignores JavaScript simply never sends it.

---

## Why ipgeolocation.io

Two endpoints do the work that would otherwise need a regex database and a datacenter IP list:

- **[User-Agent API](https://ipgeolocation.io/documentation/user-agent-api.html)** — parses the string into a client type, name, engine, and device. It reports `HeadlessChrome` as a **Robot** even though the string says Chrome, which a naive substring check would miss. Reading the agent from the request header is what makes checking an arbitrary pasted string possible on the free tier.
- **[IP Geolocation API](https://ipgeolocation.io/documentation/ip-location-api.html)** with `include=network` — returns `asn.type` (HOSTING, ISP, BUSINESS, EDUCATION) plus `connection_type`, `is_anycast`, and `is_cdn`. A consumer line reports Cable, DSL, or Mobile; a datacenter range reports nothing. That single difference separates most people from most servers.
- **Free tier** — both work on the free plan, at one call each per subject, cached for 30 minutes.

> ipgeolocation.io also offers [ASN](https://ipgeolocation.io/documentation/asn-api.html), [Security](https://ipgeolocation.io/documentation/ip-security-api.html) (VPN, proxy, Tor detection), [Timezone](https://ipgeolocation.io/documentation/timezone-api.html), [Astronomy](https://ipgeolocation.io/documentation/astronomy-api.html), and [Abuse Contact](https://ipgeolocation.io/documentation/ip-abuse-contact-api.html) APIs.

**[Get your free API key →](https://ipgeolocation.io/signup)**

---

## What this is not

It is the honest half of bot detection. Production systems use these same signals plus behavioural timing, challenge responses, and reputation built from traffic across many sites — and they do not show their reasoning. Here, every weight is on screen.

Every client-side signal can be patched out by a well-built automation stack, and a User-Agent is a string anyone can set. The network and header checks are harder to fake, which is why they still carry weight. Scoring high is also not an accusation: well-behaved crawlers identify themselves on purpose.

---

## Features

- **Three subjects** — yourself, a pasted User-Agent, or an IP address, told apart without asking
- **Auditable score** — every signal with its signed contribution and a running total
- **Confidence caps** that stop partial evidence producing a confident verdict
- **Works with JavaScript off** — the server renders a complete verdict, and the missing browser signals are scored as the tell they are
- **Shareable URLs** — every result is a link
- **SEO-ready** — Open Graph tags, meta description, `robots.txt`, `sitemap.xml`, and favicon

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js](https://nextjs.org/) (App Router) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Language | TypeScript |
| Icons | [lucide-react](https://lucide.dev/) |
| Signals | [ipgeolocation.io](https://ipgeolocation.io) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- An [ipgeolocation.io](https://ipgeolocation.io/signup) API key (free tier is enough)

### Run It Locally

1. Clone the repo:

```bash
git clone https://github.com/Abdullah-Afzal178/bot-vs-human-checker.git
cd bot-vs-human-checker
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the project root:

```env
IPGEOLOCATION_API_KEY=your_api_key_here
```

4. Start the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000).

> On `localhost` your request has no public IP, so there is no network to judge and the page says so. The User-Agent and browser checks still run.

---

## Tests

The scoring engine, input classifier, and signal codec are pure functions with no dependencies, covered by 153 assertions:

```bash
npm test
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `IPGEOLOCATION_API_KEY` | Yes | Your [ipgeolocation.io](https://ipgeolocation.io/signup) API key |
| `NEXT_PUBLIC_SITE_URL` | No | Your production URL if you deploy (used for sitemap and OG metadata) |

---

## How It Works

1. The query is classified as empty (judge the visitor), an IP address, or a User-Agent string.
2. The relevant lookups run — the User-Agent API with the string forwarded as a request header, the Geolocation API with `include=network` — and are cached for 30 minutes.
3. A verdict is scored and rendered immediately, from the request alone.
4. When judging a visitor, an inline script reads what the browser exposes, listens briefly for real input, then reloads the page once with the signals encoded in a query parameter. Every field is range-checked on the way back in, because that parameter is attacker-controlled.
5. The server scores again with the browser signals included. If the script never runs, step 3's verdict stands — and the silence counts against it.

---

## Project Structure

```
bot-vs-human-checker/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                 # Verdict, ledger, form
│   ├── opengraph-image.tsx
│   ├── robots.ts
│   └── sitemap.ts
├── components/
│   ├── verdict-gauge.tsx        # The dial
│   ├── evidence-ledger.tsx      # Every signal and its weight
│   ├── browser-probe.tsx        # Inline script, no hydration
│   ├── check-form.tsx
│   └── powered-by-badge.tsx
├── lib/
│   ├── scoring.ts               # The engine (pure)
│   ├── input.ts                 # IP vs User-Agent (pure)
│   ├── signal-codec.ts          # Browser signals over the URL (pure)
│   ├── verdict-style.ts
│   ├── detect.ts                # API lookups (server only)
│   └── session-cache.ts
├── .env                         # API key (not committed)
└── README.md
```

---

## Want to Deploy It?

Works out of the box on any platform that supports Next.js:

- **Vercel** — import the repo, add `IPGEOLOCATION_API_KEY`, deploy.
- **Netlify**, **Cloudflare Pages**, **Railway** — similar process.
- **Self-hosted** — `npm run build && npm start`.

---

## License

MIT — see [LICENSE](LICENSE) for details.
