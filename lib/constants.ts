export const SITE_NAME = "Bot or Human";

export const PAGE_TITLE = "Bot vs Human Checker";

export const PAGE_DESCRIPTION =
  "See whether a visitor looks like a person or a machine, and exactly which signals say so — User-Agent, network type, request headers, and browser automation tells.";

export const POWERED_BY_URL = "https://ipgeolocation.io";

/** How long the page listens for input before sending its browser signals. */
export const PROBE_WINDOW_MS = 700;

export const INPUT_HINT =
  "Paste a User-Agent string or an IP address — or leave it empty to check yourself";

export const EXAMPLES = [
  { query: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", label: "Googlebot" },
  { query: "curl/8.5.0", label: "curl" },
  {
    query:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36",
    label: "Headless Chrome",
  },
  { query: "3.80.0.1", label: "An AWS address" },
];
