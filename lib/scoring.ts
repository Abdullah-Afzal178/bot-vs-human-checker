/**
 * Weighs every signal into one bot score. Pure and dependency-free: no network
 * call, no browser API, no clock — so the whole verdict can be unit tested.
 *
 * The score runs 0-100, where 0 is certainly a person and 100 is certainly a
 * machine. It starts at 50 because, knowing nothing at all, it is a coin flip.
 */

export const BASELINE = 50;

export type SignalGroup = "agent" | "network" | "headers" | "browser";

export type Signal = {
  id: string;
  group: SignalGroup;
  /** What was checked. */
  label: string;
  /** What was actually seen. */
  observed: string;
  /** Signed: positive is more bot-like, negative is more human-like. */
  weight: number;
  /** Why it counts. */
  note: string;
};

export type Verdict = "human" | "likely-human" | "uncertain" | "likely-bot" | "bot";

export type Assessment = {
  signals: Signal[];
  /** Clamped to 0-100, and to the confidence the evidence supports. */
  score: number;
  verdict: Verdict;
  /** How far from the baseline this evidence was allowed to move. */
  cap: number;
  /** Set when the cap, not the signals, decided the final number. */
  capReason: string | null;
};

/** What the page knows, from whichever sources were available. */
export type Observations = {
  /**
   * Who is being judged. This decides which absences are evidence and which
   * are simply not applicable: a live visitor that sends no User-Agent is
   * suspicious, but an IP address was never going to have one.
   */
  subject: "visitor" | "agent" | "ip";
  agent: AgentFacts | null;
  network: NetworkFacts | null;
  headers: HeaderFacts;
  browser: BrowserSignals | null;
};

export type AgentFacts = {
  raw: string;
  /** The API's own call: "Browser", "Robot", or empty. */
  type: string;
  name: string;
  version: string;
  deviceType: string;
};

export type NetworkFacts = {
  /** HOSTING, ISP, BUSINESS, EDUCATION, GOVERNMENT… */
  asnType: string;
  /** Cable, DSL, Mobile… empty on datacenter ranges. */
  connectionType: string;
  isAnycast: boolean;
  isCdn: boolean;
  organization: string;
};

export type HeaderFacts = {
  acceptLanguage: string;
  accept: string;
  secChUa: string;
};

export type BrowserSignals = {
  webdriver: boolean;
  pluginCount: number;
  languageCount: number;
  webglRenderer: string;
  hasChromeObject: boolean;
  /** Notification.permission says "default" while the Permissions API says "denied". */
  permissionMismatch: boolean;
  screenWidth: number;
  screenHeight: number;
  hardwareConcurrency: number;
  touchPoints: number;
  /** A real pointer, key, or scroll event arrived before the check ran. */
  interacted: boolean;
};

/** Crawlers that say who they are. Being on this list is not a bad thing. */
const DECLARED_CRAWLERS = [
  "googlebot",
  "bingbot",
  "slurp",
  "duckduckbot",
  "baiduspider",
  "yandexbot",
  "applebot",
  "gptbot",
  "claudebot",
  "perplexitybot",
  "ccbot",
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "slackbot",
  "discordbot",
  "telegrambot",
  "whatsapp",
  "ahrefsbot",
  "semrushbot",
  "mj12bot",
  "dotbot",
  "petalbot",
  "amazonbot",
  "bytespider",
];

/** Automation frameworks that leave their name in the User-Agent. */
const AUTOMATION_MARKERS = [
  "headlesschrome",
  "phantomjs",
  "electron",
  "puppeteer",
  "playwright",
  "selenium",
  "webdriver",
  "cypress",
];

/** Software renderers: a GPU-less machine, which usually means headless. */
const SOFTWARE_RENDERERS = ["swiftshader", "llvmpipe", "mesa offscreen", "virgl", "softpipe"];

/** Connection types only a consumer line reports. */
const RESIDENTIAL_CONNECTIONS = ["cable", "dsl", "mobile", "fiber", "fttx", "dialup", "wireless"];

export function assess(observations: Observations): Assessment {
  const signals = [
    ...agentSignals(observations),
    ...networkSignals(observations),
    ...headerSignals(observations),
    ...browserSignals(observations),
  ];

  const raw = signals.reduce((sum, signal) => sum + signal.weight, BASELINE);
  const { cap, reason } = confidenceCap(observations);

  const bounded = Math.max(BASELINE - cap, Math.min(BASELINE + cap, Math.round(raw)));
  const score = Math.max(0, Math.min(100, bounded));

  return {
    signals,
    score,
    verdict: verdictFor(score),
    cap,
    // Only report a reason when limited confidence moved the number. Hitting
    // 0 or 100 on a full range is the scale's end, not a lack of evidence.
    capReason: reason !== "" && bounded !== Math.round(raw) ? reason : null,
  };
}

/**
 * Partial evidence must not produce a confident answer. A datacenter address
 * on its own is a reason to look closer, not a conviction — so how far the
 * score may travel from the baseline depends on what was actually available.
 */
function confidenceCap(observations: Observations): { cap: number; reason: string } {
  const hasAgent = observations.agent !== null && observations.agent.raw.trim() !== "";
  const hasBrowser = observations.browser !== null;
  const hasNetwork = observations.network !== null;

  if (observations.subject === "ip" || (!hasAgent && !hasBrowser)) {
    return {
      cap: 25,
      reason:
        "An address alone cannot settle this. Plenty of people browse from datacenters, and plenty of bots run from homes.",
    };
  }

  if (!hasBrowser && !hasNetwork) {
    return {
      cap: 40,
      reason:
        "A User-Agent is a string anyone can set, so on its own it caps how certain this can be.",
    };
  }

  if (!hasBrowser) {
    return {
      cap: 45,
      reason: "Without any browser signals, the request alone leaves some doubt.",
    };
  }

  // No confidence restriction: the 0-100 scale is the only bound left.
  return { cap: 50, reason: "" };
}

export function verdictFor(score: number): Verdict {
  if (score < 20) return "human";
  if (score < 40) return "likely-human";
  if (score < 60) return "uncertain";
  if (score < 80) return "likely-bot";
  return "bot";
}

function agentSignals({ subject, agent }: Observations): Signal[] {
  // An address was never going to carry a User-Agent, so its absence says
  // nothing at all. Only a live request can be judged for not sending one.
  if (subject === "ip") {
    return [];
  }

  if (!agent || agent.raw.trim() === "") {
    return [
      {
        id: "agent-missing",
        group: "agent",
        label: "User-Agent header",
        observed: "Not sent",
        weight: 35,
        note: "Every browser sends one. Scripts frequently do not bother.",
      },
    ];
  }

  const signals: Signal[] = [];
  const raw = agent.raw.toLowerCase();
  const name = agent.name.toLowerCase();
  const crawler = DECLARED_CRAWLERS.find((item) => raw.includes(item) || name.includes(item));
  const automation = AUTOMATION_MARKERS.find((item) => raw.includes(item));

  if (crawler) {
    signals.push({
      id: "agent-crawler",
      group: "agent",
      label: "Declared identity",
      observed: agent.name || crawler,
      weight: 45,
      note: "Names itself as a crawler, which well-behaved bots do on purpose.",
    });
  } else if (automation) {
    signals.push({
      id: "agent-automation",
      group: "agent",
      label: "Automation marker",
      observed: automation,
      weight: 45,
      note: "The User-Agent carries the name of a browser-automation tool.",
    });
  } else if (agent.type.toLowerCase() === "robot") {
    signals.push({
      id: "agent-robot",
      group: "agent",
      label: "Client type",
      observed: agent.name ? `${agent.name} (robot)` : "Robot",
      weight: 40,
      note: "Parsed as an automated client rather than a browser.",
    });
  } else if (agent.type.toLowerCase() === "browser") {
    signals.push({
      id: "agent-browser",
      group: "agent",
      label: "Client type",
      observed: [agent.name, agent.version].filter(Boolean).join(" ") || "Browser",
      weight: -20,
      note: "Parsed as a real browser build.",
    });
  } else {
    signals.push({
      id: "agent-unknown",
      group: "agent",
      label: "Client type",
      observed: "Unrecognised",
      weight: 15,
      note: "Matches no known browser or bot, which is itself unusual.",
    });
  }

  return signals;
}

function networkSignals({ network }: Observations): Signal[] {
  if (!network) {
    return [];
  }

  const signals: Signal[] = [];
  const type = network.asnType.toUpperCase();
  const connection = network.connectionType.toLowerCase();
  const residential = RESIDENTIAL_CONNECTIONS.some((item) => connection.includes(item));

  if (type === "HOSTING") {
    signals.push({
      id: "network-hosting",
      group: "network",
      label: "Network type",
      observed: `Datacenter — ${network.organization || "hosting provider"}`,
      weight: 30,
      note: "People browse from homes and offices. Servers live in datacenters.",
    });
  } else if (type === "ISP" && residential) {
    signals.push({
      id: "network-residential",
      group: "network",
      label: "Network type",
      observed: `Residential ${network.connectionType} — ${network.organization || "ISP"}`,
      weight: -25,
      note: "A consumer line reports its connection type. Datacenter ranges do not.",
    });
  } else if (type === "ISP") {
    signals.push({
      id: "network-isp",
      group: "network",
      label: "Network type",
      observed: `Consumer ISP — ${network.organization || "unknown"}`,
      weight: -10,
      note: "An access provider, though the connection type is not reported.",
    });
  } else if (type === "EDUCATION" || type === "GOVERNMENT") {
    signals.push({
      id: "network-institution",
      group: "network",
      label: "Network type",
      observed: `${titleCase(type)} — ${network.organization || "unknown"}`,
      weight: -5,
      note: "An institutional network carries far more people than scripts.",
    });
  } else if (type === "BUSINESS") {
    signals.push({
      id: "network-business",
      group: "network",
      label: "Network type",
      observed: `Business — ${network.organization || "unknown"}`,
      weight: 0,
      note: "Corporate ranges carry staff and automation in equal measure.",
    });
  }

  if (network.isAnycast) {
    signals.push({
      id: "network-anycast",
      group: "network",
      label: "Anycast address",
      observed: "Yes",
      weight: 10,
      note: "An anycast address belongs to infrastructure, not to one machine.",
    });
  }

  if (network.isCdn) {
    signals.push({
      id: "network-cdn",
      group: "network",
      label: "CDN range",
      observed: "Yes",
      weight: 10,
      note: "The request arrives from a CDN, so the real origin is hidden.",
    });
  }

  return signals;
}

function headerSignals({ subject, agent, headers }: Observations): Signal[] {
  // Only a real request has headers. A pasted string arrives with none, and
  // crediting or penalising it for that would be inventing evidence.
  if (subject !== "visitor") {
    return [];
  }

  const signals: Signal[] = [];

  if (headers.acceptLanguage.trim() === "") {
    signals.push({
      id: "headers-language",
      group: "headers",
      label: "Accept-Language",
      observed: "Not sent",
      weight: 15,
      note: "Browsers always advertise a language. Scripts rarely do.",
    });
  } else {
    signals.push({
      id: "headers-language-present",
      group: "headers",
      label: "Accept-Language",
      observed: truncate(headers.acceptLanguage, 40),
      weight: -8,
      note: "A language preference is what a configured browser sends.",
    });
  }

  if (headers.accept.trim() === "") {
    signals.push({
      id: "headers-accept",
      group: "headers",
      label: "Accept",
      observed: "Not sent",
      weight: 10,
      note: "A browser states which content types it can render.",
    });
  }

  // Chromium has sent client hints on every request since Chrome 89.
  const isChromium =
    agent !== null && /chrome|edg|chromium|opera|opr/i.test(`${agent.name} ${agent.raw}`);

  if (isChromium && headers.secChUa.trim() === "") {
    signals.push({
      id: "headers-hints-missing",
      group: "headers",
      label: "Client hints",
      observed: "Absent, but the User-Agent claims Chromium",
      weight: 12,
      note: "Real Chromium sends Sec-CH-UA. A forged string usually forgets to.",
    });
  } else if (!isChromium && headers.secChUa.trim() !== "") {
    signals.push({
      id: "headers-hints-mismatch",
      group: "headers",
      label: "Client hints",
      observed: "Present, but the User-Agent is not Chromium",
      weight: 8,
      note: "The headers and the User-Agent disagree about the browser.",
    });
  }

  return signals;
}

function browserSignals({ subject, agent, browser }: Observations): Signal[] {
  if (!browser) {
    // Only meaningful when judging a live visitor: a pasted string has no
    // browser to report, and must not be marked down for staying silent.
    return subject === "visitor"
      ? [
          {
            id: "browser-silent",
            group: "browser",
            label: "JavaScript signals",
            observed: "None received",
            weight: 15,
            note: "A real browser runs the script on this page. Most crawlers do not.",
          },
        ]
      : [];
  }

  const signals: Signal[] = [];

  signals.push(
    browser.webdriver
      ? {
          id: "browser-webdriver",
          group: "browser",
          label: "navigator.webdriver",
          observed: "true",
          weight: 40,
          note: "The browser is admitting it is under automated control.",
        }
      : {
          id: "browser-no-webdriver",
          group: "browser",
          label: "navigator.webdriver",
          observed: "false",
          weight: -10,
          note: "No automation flag set, though it can be patched out.",
        },
  );

  const renderer = browser.webglRenderer.toLowerCase();

  if (SOFTWARE_RENDERERS.some((item) => renderer.includes(item))) {
    signals.push({
      id: "browser-software-gpu",
      group: "browser",
      label: "Graphics renderer",
      observed: truncate(browser.webglRenderer, 44),
      weight: 25,
      note: "Rendering in software means no real GPU, which is typical of headless.",
    });
  } else if (browser.webglRenderer.trim() !== "") {
    signals.push({
      id: "browser-hardware-gpu",
      group: "browser",
      label: "Graphics renderer",
      observed: truncate(browser.webglRenderer, 44),
      weight: -10,
      note: "A real GPU is reported, which headless environments seldom have.",
    });
  }

  if (browser.languageCount === 0) {
    signals.push({
      id: "browser-languages",
      group: "browser",
      label: "navigator.languages",
      observed: "Empty",
      weight: 15,
      note: "An empty language list is a long-standing headless giveaway.",
    });
  }

  if (browser.permissionMismatch) {
    signals.push({
      id: "browser-permissions",
      group: "browser",
      label: "Notification permission",
      observed: "Reported two different ways at once",
      weight: 20,
      note: "The Permissions API and Notification.permission disagree, which only happens under automation.",
    });
  }

  const claimsChrome = agent !== null && /chrome|chromium/i.test(`${agent.name} ${agent.raw}`);

  if (claimsChrome && !browser.hasChromeObject) {
    signals.push({
      id: "browser-chrome-object",
      group: "browser",
      label: "window.chrome",
      observed: "Missing, but the User-Agent claims Chrome",
      weight: 12,
      note: "Chrome exposes this object. A spoofed User-Agent usually cannot.",
    });
  }

  if (browser.screenWidth === 0 || browser.screenHeight === 0) {
    signals.push({
      id: "browser-screen",
      group: "browser",
      label: "Screen size",
      observed: `${browser.screenWidth} × ${browser.screenHeight}`,
      weight: 15,
      note: "A zero-sized screen means nothing is actually being displayed.",
    });
  }

  if (browser.hardwareConcurrency === 0) {
    signals.push({
      id: "browser-cores",
      group: "browser",
      label: "CPU cores",
      observed: "Not reported",
      weight: 8,
      note: "Browsers report a core count. A stripped environment may not.",
    });
  }

  if (browser.interacted) {
    signals.push({
      id: "browser-interaction",
      group: "browser",
      label: "Input activity",
      observed: "Pointer, key, or scroll seen",
      weight: -15,
      note: "Something moved on this page, which is hard to fake convincingly.",
    });
  }

  return signals;
}

/** Splits signals for display without losing any. */
export function groupSignals(signals: Signal[]) {
  const order: SignalGroup[] = ["agent", "network", "headers", "browser"];

  return order
    .map((group) => ({ group, signals: signals.filter((signal) => signal.group === group) }))
    .filter((entry) => entry.signals.length > 0);
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function truncate(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
