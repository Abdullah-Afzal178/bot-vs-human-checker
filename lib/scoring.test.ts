import assert from "node:assert/strict";

import {
  BASELINE,
  assess,
  groupSignals,
  verdictFor,
  type BrowserSignals,
  type Observations,
} from "@/lib/scoring";

let checks = 0;
function check(actual: unknown, expected: unknown, message: string) {
  checks += 1;
  assert.deepEqual(actual, expected, message);
}
function truthy(value: unknown, message: string) {
  checks += 1;
  assert.ok(value, message);
}

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function observe(overrides: Partial<Observations> = {}): Observations {
  return {
    // The complete case by default; lookups pass their own subject.
    subject: "visitor",
    agent: { raw: CHROME_UA, type: "Browser", name: "Chrome", version: "120", deviceType: "Desktop" },
    network: {
      asnType: "ISP",
      connectionType: "Cable",
      isAnycast: false,
      isCdn: false,
      organization: "Comcast Cable",
    },
    headers: { acceptLanguage: "en-US,en;q=0.9", accept: "text/html", secChUa: '"Chromium";v="120"' },
    browser: null,
    ...overrides,
  };
}

function browserFacts(overrides: Partial<BrowserSignals> = {}): BrowserSignals {
  return {
    webdriver: false,
    pluginCount: 3,
    languageCount: 2,
    webglRenderer: "ANGLE (NVIDIA GeForce RTX 3060)",
    hasChromeObject: true,
    permissionMismatch: false,
    screenWidth: 2560,
    screenHeight: 1440,
    hardwareConcurrency: 8,
    touchPoints: 0,
    interacted: false,
    ...overrides,
  };
}

const idsOf = (o: Observations) => assess(o).signals.map((s) => s.id);
const weightOf = (o: Observations, id: string) =>
  assess(o).signals.find((s) => s.id === id)?.weight;

// --- verdict bands -----------------------------------------------------
check(verdictFor(0), "human", "0 is a person");
check(verdictFor(19), "human", "19 is still human");
check(verdictFor(20), "likely-human", "20 crosses into likely-human");
check(verdictFor(39), "likely-human", "39 is the top of likely-human");
check(verdictFor(40), "uncertain", "40 is uncertain");
check(verdictFor(59), "uncertain", "59 is the top of uncertain");
check(verdictFor(60), "likely-bot", "60 crosses into likely-bot");
check(verdictFor(79), "likely-bot", "79 is the top of likely-bot");
check(verdictFor(80), "bot", "80 is a bot");
check(verdictFor(100), "bot", "100 is certainly a bot");

// --- the score is clamped and anchored ---------------------------------
{
  const empty: Observations = {
    subject: "agent",
    agent: null,
    network: null,
    headers: { acceptLanguage: "", accept: "", secChUa: "" },
    browser: null,
  };
  // Nothing but the two missing-header penalties and the absent User-Agent.
  const result = assess(empty);
  truthy(result.score > BASELINE, "knowing nothing but seeing nothing sent leans bot");

  const everythingBot = assess(
    observe({
      subject: "visitor",
      agent: { raw: "curl/8.5.0", type: "Robot", name: "Curl", version: "8.5.0", deviceType: "Robot" },
      network: { asnType: "HOSTING", connectionType: "", isAnycast: true, isCdn: true, organization: "AWS" },
      headers: { acceptLanguage: "", accept: "", secChUa: "" },
      browser: browserFacts({ webdriver: true, webglRenderer: "SwiftShader", languageCount: 0 }),
    }),
  );
  check(everythingBot.score, 100, "an overwhelming case clamps at 100, never above");
  check(everythingBot.verdict, "bot", "and reads as a bot");

  const everythingHuman = assess(
    observe({ browser: browserFacts({ interacted: true }) }),
  );
  truthy(everythingHuman.score >= 0, "the score never goes below 0");
  check(everythingHuman.verdict, "human", "a residential browser with input is a person");
}

// --- user agent --------------------------------------------------------
{
  truthy(idsOf(observe()).includes("agent-browser"), "a parsed browser is recognised");
  check(weightOf(observe(), "agent-browser"), -20, "a real browser pulls the score down");

  const missing = observe({ agent: null });
  truthy(idsOf(missing).includes("agent-missing"), "a missing User-Agent is flagged");

  const blank = observe({
    agent: { raw: "   ", type: "", name: "", version: "", deviceType: "" },
  });
  truthy(idsOf(blank).includes("agent-missing"), "a whitespace-only User-Agent counts as missing");

  // A declared crawler is identified as such rather than as generic automation.
  const googlebot = observe({
    agent: {
      raw: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      type: "Robot",
      name: "Googlebot",
      version: "2.1",
      deviceType: "Robot",
    },
  });
  truthy(idsOf(googlebot).includes("agent-crawler"), "Googlebot is a declared crawler");
  truthy(!idsOf(googlebot).includes("agent-robot"), "a declared crawler is not double-counted");

  const gptbot = observe({
    agent: { raw: "GPTBot/1.0 (+https://openai.com/gptbot)", type: "Robot", name: "GPTBot", version: "1.0", deviceType: "Robot" },
  });
  truthy(idsOf(gptbot).includes("agent-crawler"), "an AI crawler is recognised too");

  // Headless Chrome calls itself Chrome; the marker in the raw string gives it away.
  const headless = observe({
    agent: {
      raw: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/120.0.0.0 Safari/537.36",
      type: "Robot",
      name: "Chrome",
      version: "120.0.0.0",
      deviceType: "Desktop",
    },
  });
  truthy(idsOf(headless).includes("agent-automation"), "HeadlessChrome is caught as automation");
  check(assess(headless).signals.find((s) => s.id === "agent-automation")?.observed, "headlesschrome", "the marker is named");

  const curl = observe({
    agent: { raw: "curl/8.5.0", type: "Robot", name: "Curl", version: "8.5.0", deviceType: "Robot" },
  });
  truthy(idsOf(curl).includes("agent-robot"), "an unlisted tool is still a robot");

  const nonsense = observe({
    agent: { raw: "hello", type: "", name: "", version: "", deviceType: "" },
  });
  truthy(idsOf(nonsense).includes("agent-unknown"), "an unparseable agent is suspicious, not neutral");

  // Exactly one verdict about the agent, whatever the input.
  for (const o of [observe(), missing, googlebot, headless, curl, nonsense]) {
    check(
      assess(o).signals.filter((s) => s.group === "agent").length,
      1,
      "the agent contributes exactly one signal",
    );
  }
}

// --- network -----------------------------------------------------------
{
  const hosting = observe({
    network: { asnType: "HOSTING", connectionType: "", isAnycast: false, isCdn: false, organization: "Amazon.com, Inc." },
  });
  check(weightOf(hosting, "network-hosting"), 30, "a datacenter pushes towards bot");
  truthy(
    assess(hosting).signals.find((s) => s.id === "network-hosting")?.observed.includes("Amazon"),
    "the hosting provider is named",
  );

  check(weightOf(observe(), "network-residential"), -25, "a residential cable line pushes towards human");

  for (const connection of ["Cable", "DSL", "Mobile", "Fiber", "Dialup", "Wireless"]) {
    const o = observe({
      network: { asnType: "ISP", connectionType: connection, isAnycast: false, isCdn: false, organization: "An ISP" },
    });
    truthy(idsOf(o).includes("network-residential"), `${connection} counts as residential`);
  }

  const bareIsp = observe({
    network: { asnType: "ISP", connectionType: "", isAnycast: false, isCdn: false, organization: "An ISP" },
  });
  truthy(idsOf(bareIsp).includes("network-isp"), "an ISP with no connection type is weaker evidence");
  check(weightOf(bareIsp, "network-isp"), -10, "and carries less weight than a confirmed line");

  const edu = observe({
    network: { asnType: "EDUCATION", connectionType: "", isAnycast: false, isCdn: false, organization: "MIT" },
  });
  check(weightOf(edu, "network-institution"), -5, "a university leans slightly human");

  const business = observe({
    network: { asnType: "BUSINESS", connectionType: "", isAnycast: false, isCdn: false, organization: "A company" },
  });
  check(weightOf(business, "network-business"), 0, "a business network is genuinely neutral");

  const anycast = observe({
    network: { asnType: "HOSTING", connectionType: "", isAnycast: true, isCdn: true, organization: "Cloudflare" },
  });
  truthy(idsOf(anycast).includes("network-anycast"), "anycast is flagged");
  truthy(idsOf(anycast).includes("network-cdn"), "a CDN range is flagged");

  check(assess(observe({ network: null })).signals.filter((s) => s.group === "network").length, 0, "no network, no network signals");
}

// --- headers -----------------------------------------------------------
{
  truthy(idsOf(observe()).includes("headers-language-present"), "a language header counts in your favour");

  const noLang = observe({ headers: { acceptLanguage: "", accept: "text/html", secChUa: '"Chromium"' } });
  check(weightOf(noLang, "headers-language"), 15, "a missing language header counts against");

  const noAccept = observe({ headers: { acceptLanguage: "en", accept: "", secChUa: '"Chromium"' } });
  truthy(idsOf(noAccept).includes("headers-accept"), "a missing Accept header is flagged");

  // Real Chromium always sends client hints.
  const chromeNoHints = observe({ headers: { acceptLanguage: "en", accept: "text/html", secChUa: "" } });
  truthy(idsOf(chromeNoHints).includes("headers-hints-missing"), "a Chromium claim without hints is suspicious");

  const safariWithHints = observe({
    agent: { raw: "Mozilla/5.0 (Macintosh) Version/17.5 Safari/605.1.15", type: "Browser", name: "Safari", version: "17.5", deviceType: "Desktop" },
    headers: { acceptLanguage: "en", accept: "text/html", secChUa: '"Chromium";v="120"' },
  });
  truthy(idsOf(safariWithHints).includes("headers-hints-mismatch"), "Safari sending Chromium hints is a contradiction");

  const safariNoHints = observe({
    agent: { raw: "Mozilla/5.0 (Macintosh) Version/17.5 Safari/605.1.15", type: "Browser", name: "Safari", version: "17.5", deviceType: "Desktop" },
    headers: { acceptLanguage: "en", accept: "text/html", secChUa: "" },
  });
  truthy(
    !idsOf(safariNoHints).some((id) => id.startsWith("headers-hints")),
    "Safari without hints is perfectly normal",
  );
}

// --- browser signals ---------------------------------------------------
{
  // A pasted string has no browser, and must not be penalised for it.
  check(
    assess(observe({ subject: "agent", browser: null })).signals.filter((s) => s.group === "browser").length,
    0,
    "a lookup is not marked down for having no browser",
  );
  truthy(
    idsOf(observe({ subject: "visitor", browser: null })).includes("browser-silent"),
    "a live visitor that runs no JavaScript is flagged",
  );

  const driven = observe({ browser: browserFacts({ webdriver: true }) });
  check(weightOf(driven, "browser-webdriver"), 40, "the automation flag is the heaviest browser signal");
  check(weightOf(observe({ browser: browserFacts() }), "browser-no-webdriver"), -10, "its absence helps, modestly");

  for (const renderer of ["SwiftShader", "llvmpipe (LLVM 15)", "Mesa OffScreen", "virgl", "softpipe"]) {
    const o = observe({ browser: browserFacts({ webglRenderer: renderer }) });
    truthy(idsOf(o).includes("browser-software-gpu"), `${renderer} is a software renderer`);
  }
  truthy(
    idsOf(observe({ browser: browserFacts() })).includes("browser-hardware-gpu"),
    "a real GPU counts in your favour",
  );
  truthy(
    !idsOf(observe({ browser: browserFacts({ webglRenderer: "" }) })).some((id) => id.includes("gpu")),
    "a hidden renderer is neither credited nor penalised",
  );

  truthy(
    idsOf(observe({ browser: browserFacts({ languageCount: 0 }) })).includes("browser-languages"),
    "an empty language list is a headless tell",
  );
  truthy(
    idsOf(observe({ browser: browserFacts({ permissionMismatch: true }) })).includes("browser-permissions"),
    "contradictory permission reporting is flagged",
  );
  truthy(
    idsOf(observe({ browser: browserFacts({ hasChromeObject: false }) })).includes("browser-chrome-object"),
    "a Chrome claim with no window.chrome is flagged",
  );
  truthy(
    !idsOf(
      observe({
        agent: { raw: "Mozilla/5.0 (Macintosh) Safari/605.1.15", type: "Browser", name: "Safari", version: "17", deviceType: "Desktop" },
        browser: browserFacts({ hasChromeObject: false }),
      }),
    ).includes("browser-chrome-object"),
    "Safari is not expected to expose window.chrome",
  );
  truthy(
    idsOf(observe({ browser: browserFacts({ screenWidth: 0 }) })).includes("browser-screen"),
    "a zero-width screen is flagged",
  );
  truthy(
    idsOf(observe({ browser: browserFacts({ screenHeight: 0 }) })).includes("browser-screen"),
    "a zero-height screen is flagged too",
  );
  truthy(
    idsOf(observe({ browser: browserFacts({ hardwareConcurrency: 0 }) })).includes("browser-cores"),
    "an unreported core count is flagged",
  );
  check(
    weightOf(observe({ browser: browserFacts({ interacted: true }) }), "browser-interaction"),
    -15,
    "real input counts strongly in your favour",
  );
}

// --- end-to-end scenarios ----------------------------------------------
{
  const realVisitor = assess(observe({ subject: "visitor", browser: browserFacts({ interacted: true }) }));
  check(realVisitor.verdict, "human", "a residential Chrome user who moved the mouse is a person");

  const googlebotFromGoogle = assess(
    observe({
      subject: "visitor",
      agent: {
        raw: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        type: "Robot",
        name: "Googlebot",
        version: "2.1",
        deviceType: "Robot",
      },
      network: { asnType: "HOSTING", connectionType: "", isAnycast: false, isCdn: false, organization: "Google LLC" },
      headers: { acceptLanguage: "", accept: "text/html", secChUa: "" },
      browser: null,
    }),
  );
  check(googlebotFromGoogle.verdict, "bot", "Googlebot from Google's network is unambiguous");

  const headlessOnAws = assess(
    observe({
      subject: "visitor",
      agent: {
        raw: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/120.0.0.0 Safari/537.36",
        type: "Robot",
        name: "Chrome",
        version: "120",
        deviceType: "Desktop",
      },
      network: { asnType: "HOSTING", connectionType: "", isAnycast: false, isCdn: false, organization: "Amazon.com, Inc." },
      headers: { acceptLanguage: "", accept: "text/html", secChUa: "" },
      browser: browserFacts({ webdriver: true, webglRenderer: "SwiftShader", languageCount: 0 }),
    }),
  );
  check(headlessOnAws.verdict, "bot", "a scraper that runs JavaScript is still caught");

  // A person on a VPN or a corporate proxy must not be branded a bot.
  const vpnUser = assess(
    observe({
      subject: "visitor",
      network: { asnType: "HOSTING", connectionType: "", isAnycast: false, isCdn: false, organization: "A VPN provider" },
      browser: browserFacts({ interacted: true }),
    }),
  );
  truthy(
    vpnUser.verdict === "human" || vpnUser.verdict === "likely-human",
    "a real browser on a VPN still reads as a person, not a bot",
  );

  // Every signal must carry a label, an observation and a reason.
  for (const signal of headlessOnAws.signals) {
    truthy(signal.label && signal.observed && signal.note, `${signal.id} is fully described`);
  }
}

// --- grouping ----------------------------------------------------------
{
  const result = assess(observe({ subject: "visitor", browser: browserFacts() }));
  const grouped = groupSignals(result.signals);
  check(
    grouped.map((entry) => entry.group),
    ["agent", "network", "headers", "browser"],
    "groups come out in a stable reading order",
  );
  check(
    grouped.reduce((sum, entry) => sum + entry.signals.length, 0),
    result.signals.length,
    "grouping loses no signals",
  );
  check(
    groupSignals([]).length,
    0,
    "an empty signal list produces no empty groups",
  );
}


// --- confidence caps ----------------------------------------------------
{
  // An address alone is suggestive, never conclusive: plenty of people browse
  // from datacenters and plenty of bots run from bedrooms.
  const awsIp = assess({
    subject: "ip",
    agent: null,
    network: { asnType: "HOSTING", connectionType: "", isAnycast: true, isCdn: true, organization: "Amazon.com, Inc." },
    headers: { acceptLanguage: "", accept: "", secChUa: "" },
    browser: null,
  });
  check(awsIp.cap, 25, "an IP lookup may move 25 points at most");
  check(awsIp.score, 75, "a datacenter address tops out at probably-a-bot");
  check(awsIp.verdict, "likely-bot", "and never reads as certain");
  truthy(awsIp.capReason, "the cap explains itself when it bites");

  const homeIp = assess({
    subject: "ip",
    agent: null,
    network: { asnType: "ISP", connectionType: "Cable", isAnycast: false, isCdn: false, organization: "Comcast" },
    headers: { acceptLanguage: "", accept: "", secChUa: "" },
    browser: null,
  });
  check(homeIp.score, 25, "a residential address bottoms out at likely-human");
  check(homeIp.verdict, "likely-human", "and is not declared a person outright");

  // An IP has no User-Agent to send, so its absence must cost nothing.
  check(
    assess({
      subject: "ip",
      agent: null,
      network: null,
      headers: { acceptLanguage: "", accept: "", secChUa: "" },
      browser: null,
    }).score,
    BASELINE,
    "an IP we know nothing about stays exactly at the baseline",
  );
  check(
    assess({
      subject: "ip",
      agent: null,
      network: null,
      headers: { acceptLanguage: "", accept: "", secChUa: "" },
      browser: null,
    }).signals.length,
    0,
    "and produces no signals at all, rather than a missing-agent penalty",
  );

  // A pasted string is not a request, so it has no headers to judge either.
  const pastedChrome = assess(observe({ subject: "agent", network: null }));
  check(
    pastedChrome.signals.filter((s) => s.group === "headers").length,
    0,
    "a pasted agent is neither credited nor penalised for headers",
  );
  check(pastedChrome.cap, 40, "a string on its own may move 40 points at most");
  check(pastedChrome.score, 30, "a Chrome string alone reads as probably human, not certainly");

  // A declared crawler is still conclusive: nobody spoofs towards being a bot.
  const pastedGooglebot = assess(
    observe({
      subject: "agent",
      network: null,
      agent: {
        raw: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        type: "Robot",
        name: "Googlebot",
        version: "2.1",
        deviceType: "Robot",
      },
    }),
  );
  check(pastedGooglebot.verdict, "bot", "a self-declared crawler is still called a bot");

  // A full visitor check has everything, so nothing is held back.
  check(
    assess(observe({ subject: "visitor", browser: browserFacts() })).cap,
    50,
    "a complete picture may use the whole range",
  );
  check(
    assess(observe({ subject: "visitor", browser: browserFacts({ interacted: true }) })).capReason,
    null,
    "and reports no cap when the cap did not bite",
  );

  // The cap narrows the range symmetrically, never shifting the midpoint.
  for (const subject of ["visitor", "agent", "ip"] as const) {
    const result = assess({
      subject,
      agent: null,
      network: null,
      headers: { acceptLanguage: "", accept: "", secChUa: "" },
      browser: null,
    });
    truthy(
      result.score >= BASELINE - result.cap && result.score <= BASELINE + result.cap,
      `${subject}: the score stays inside its own cap`,
    );
  }
}

console.log(`scoring: ${checks} assertions passed`);
