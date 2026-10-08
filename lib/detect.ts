import "server-only";

import { headers } from "next/headers";

import { parseInput } from "@/lib/input";
import { getSessionCache, setSessionCache } from "@/lib/session-cache";
import type { AgentFacts, HeaderFacts, NetworkFacts, Observations } from "@/lib/scoring";

const UA_ENDPOINT = "https://api.ipgeolocation.io/v3/user-agent";
const GEO_ENDPOINT = "https://api.ipgeolocation.io/v3/ipgeo";

export type Subject = {
  observations: Observations;
  /** What the verdict is about, for the heading. */
  title: string;
  ip: string | null;
  /** Set when something could not be looked up; the verdict still renders. */
  notes: string[];
};

export async function inspect(raw: string): Promise<Subject> {
  const parsed = parseInput(raw);
  const headerStore = await headers();
  const notes: string[] = [];

  const headerFacts: HeaderFacts =
    parsed.kind === "self"
      ? {
          acceptLanguage: headerStore.get("accept-language") ?? "",
          accept: headerStore.get("accept") ?? "",
          secChUa: headerStore.get("sec-ch-ua") ?? "",
        }
      : // A pasted string arrives with no request of its own. The scorer skips
        // header checks for it entirely, so these are never read.
        { acceptLanguage: "", accept: "", secChUa: "" };

  if (parsed.kind === "ip") {
    const network = await lookupNetwork(parsed.ip, notes);

    return {
      observations: { subject: "ip", agent: null, network, headers: headerFacts, browser: null },
      title: parsed.ip,
      ip: parsed.ip,
      notes,
    };
  }

  if (parsed.kind === "agent") {
    const agent = await lookupAgent(parsed.agent, notes);

    return {
      observations: { subject: "agent", agent, network: null, headers: headerFacts, browser: null },
      title: parsed.agent,
      ip: null,
      notes,
    };
  }

  const ip = publicClientIp(headerStore);
  const userAgent = headerStore.get("user-agent") ?? "";

  const [agent, network] = await Promise.all([
    userAgent ? lookupAgent(userAgent, notes) : Promise.resolve(null),
    ip ? lookupNetwork(ip, notes) : Promise.resolve(null),
  ]);

  if (!ip) {
    notes.push(
      "This request has no public IP — on localhost there is no network to judge, so only the browser signals count.",
    );
  }

  return {
    observations: { subject: "visitor", agent, network, headers: headerFacts, browser: null },
    title: "You",
    ip,
    notes,
  };
}

/**
 * The User-Agent API reads the string from the request header, which is what
 * makes checking an arbitrary pasted agent possible on the free tier.
 */
async function lookupAgent(userAgent: string, notes: string[]): Promise<AgentFacts | null> {
  const apiKey = process.env.IPGEOLOCATION_API_KEY;

  if (!apiKey) {
    notes.push("Set IPGEOLOCATION_API_KEY in your .env file to enable User-Agent analysis.");
    return null;
  }

  const cacheKey = `ua:${userAgent}`;
  const cached = getSessionCache<AgentFacts>(cacheKey);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(`${UA_ENDPOINT}?apiKey=${encodeURIComponent(apiKey)}`, {
      cache: "no-store",
      headers: { Accept: "application/json", "User-Agent": userAgent },
    });

    if (!response.ok) {
      notes.push(`The User-Agent lookup failed with status ${response.status}.`);
      return bareAgent(userAgent);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const device = asObject(payload.device);

    const facts: AgentFacts = {
      raw: userAgent,
      type: clean(payload.type),
      name: clean(payload.name),
      version: clean(payload.version),
      deviceType: clean(device?.type),
    };

    setSessionCache(cacheKey, facts);

    return facts;
  } catch {
    notes.push("The User-Agent lookup could not be completed.");
    return bareAgent(userAgent);
  }
}

/** Keeps the raw string in play so the local checks still run without the API. */
function bareAgent(userAgent: string): AgentFacts {
  return { raw: userAgent, type: "", name: "", version: "", deviceType: "" };
}

async function lookupNetwork(ip: string, notes: string[]): Promise<NetworkFacts | null> {
  const apiKey = process.env.IPGEOLOCATION_API_KEY;

  if (!apiKey) {
    return null;
  }

  const cacheKey = `net:${ip}`;
  const cached = getSessionCache<NetworkFacts>(cacheKey);

  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({ apiKey, ip, include: "network" });

  try {
    const response = await fetch(`${GEO_ENDPOINT}?${params.toString()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      notes.push(
        response.status === 423
          ? `${ip} is a private or reserved address, so it belongs to no public network.`
          : `The network lookup failed with status ${response.status}.`,
      );
      return null;
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const network = asObject(payload.network);
    const asn = asObject(payload.asn);

    const facts: NetworkFacts = {
      asnType: clean(asn?.type),
      connectionType: clean(network?.connection_type),
      isAnycast: network?.is_anycast === true,
      isCdn: network?.is_cdn === true,
      organization: clean(asn?.organization),
    };

    setSessionCache(cacheKey, facts);

    return facts;
  } catch {
    notes.push("The network lookup could not be completed.");
    return null;
  }
}

function publicClientIp(headerStore: Headers): string | null {
  const candidates = [
    headerStore.get("cf-connecting-ip"),
    headerStore.get("x-real-ip"),
    headerStore.get("x-vercel-forwarded-for"),
    headerStore.get("x-forwarded-for"),
  ];

  for (const value of candidates) {
    const ip = value
      ?.split(",")
      .map((item) => item.trim().replace(/^\[|\]$/g, ""))
      .find((item) => item && isPublic(item));

    if (ip) {
      return ip;
    }
  }

  return null;
}

function isPublic(ip: string): boolean {
  if (ip.includes(":")) {
    const normalized = ip.toLowerCase();

    return !(
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80") ||
      normalized.startsWith("::ffff:127.")
    );
  }

  const octets = ip.split(".").map(Number);

  if (octets.length !== 4 || octets.some((part) => !Number.isFinite(part))) {
    return false;
  }

  return !(
    octets[0] === 10 ||
    octets[0] === 127 ||
    octets[0] === 0 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127)
  );
}

/** The API uses "??" and "Unknown" where it has no value. */
function clean(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";

  return text === "??" || text === "Unknown" ? "" : text;
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
