/**
 * Works out what was pasted into the box: an IP address, or a User-Agent
 * string. Pure, so the classification can be unit tested on its own.
 */

export type ParsedInput =
  | { kind: "self" }
  | { kind: "ip"; ip: string }
  | { kind: "agent"; agent: string };

/** Longer than any real User-Agent, and long enough to stop a URL bloating. */
export const MAX_INPUT = 512;

export function parseInput(raw: string): ParsedInput {
  const text = raw.trim().slice(0, MAX_INPUT);

  if (text === "") {
    return { kind: "self" };
  }

  // An IP is the only input with no spaces that parses as an address, so test
  // it first — "curl/8.5.0" must not be mistaken for one.
  const bare = text.replace(/^\[|\]$/g, "");

  if (isIpv4(bare) || isIpv6(bare)) {
    return { kind: "ip", ip: bare };
  }

  return { kind: "agent", agent: text };
}

function isIpv4(value: string): boolean {
  const parts = value.split(".");

  if (parts.length !== 4) {
    return false;
  }

  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return false;
    }

    // Reject "01" so an octal-looking octet is never silently accepted.
    if (part.length > 1 && part.startsWith("0")) {
      return false;
    }

    return Number.parseInt(part, 10) <= 255;
  });
}

function isIpv6(value: string): boolean {
  if (!value.includes(":") || value.includes(":::") || /\s/.test(value)) {
    return false;
  }

  const zoneless = value.split("%")[0];

  if ((zoneless.split("::").length - 1) > 1) {
    return false;
  }

  const compressed = zoneless.includes("::");
  const [head, tail = ""] = zoneless.split("::");
  const groups = [
    ...(head === "" ? [] : head.split(":")),
    ...(tail === "" ? [] : tail.split(":")),
  ];

  // A trailing IPv4 form (::ffff:192.0.2.1) occupies two groups.
  const last = groups[groups.length - 1];
  const embedded = last !== undefined && last.includes(".");

  if (embedded) {
    if (!isIpv4(last)) {
      return false;
    }

    groups.pop();
  }

  if (!groups.every((group) => /^[0-9a-f]{1,4}$/i.test(group))) {
    return false;
  }

  const width = groups.length + (embedded ? 2 : 0);

  return compressed ? width <= 7 : width === 8;
}
