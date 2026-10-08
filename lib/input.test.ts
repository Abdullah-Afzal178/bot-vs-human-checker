import assert from "node:assert/strict";

import { MAX_INPUT, parseInput } from "@/lib/input";

let checks = 0;
function check(actual: unknown, expected: unknown, message: string) {
  checks += 1;
  assert.deepEqual(actual, expected, message);
}

// --- nothing typed -----------------------------------------------------
check(parseInput(""), { kind: "self" }, "empty means check me");
check(parseInput("   "), { kind: "self" }, "whitespace means check me");
check(parseInput("\n\t"), { kind: "self" }, "newlines mean check me");

// --- IP addresses ------------------------------------------------------
check(parseInput("8.8.8.8"), { kind: "ip", ip: "8.8.8.8" }, "plain IPv4");
check(parseInput("  1.1.1.1  "), { kind: "ip", ip: "1.1.1.1" }, "IPv4 is trimmed");
check(parseInput("255.255.255.255").kind, "ip", "the broadcast address parses");
check(parseInput("2606:4700:4700::1111").kind, "ip", "compressed IPv6");
check(parseInput("[2606:4700::1111]"), { kind: "ip", ip: "2606:4700::1111" }, "brackets are stripped");
check(parseInput("::1").kind, "ip", "loopback");
check(parseInput("::ffff:192.0.2.1").kind, "ip", "IPv4-mapped IPv6");
check(parseInput("fe80::1%eth0").kind, "ip", "a zone index is tolerated");

// --- things that look like IPs but are not -----------------------------
check(parseInput("256.1.1.1").kind, "agent", "an octet above 255 is not an IP");
check(parseInput("1.1.1").kind, "agent", "three octets is not an IP");
check(parseInput("01.1.1.1").kind, "agent", "an octal-looking octet is rejected");
check(parseInput("2001::4860::1").kind, "agent", "two :: runs is not an IP");
check(parseInput("2001:gggg::1").kind, "agent", "a non-hex group is not an IP");

// --- user agents -------------------------------------------------------
{
  const chrome =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  check(parseInput(chrome), { kind: "agent", agent: chrome }, "a browser UA is kept verbatim");
  check(parseInput("curl/8.5.0"), { kind: "agent", agent: "curl/8.5.0" }, "a tool UA is not mistaken for an IP");
  check(parseInput("python-requests/2.31.0").kind, "agent", "a library UA parses as an agent");
  check(
    parseInput("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)").kind,
    "agent",
    "a crawler UA parses as an agent",
  );
  const trimmed = parseInput("  curl/8.5.0  ");
  check(trimmed.kind === "agent" && trimmed.agent, "curl/8.5.0", "an agent is trimmed");
}

// --- length cap --------------------------------------------------------
{
  const long = "A".repeat(MAX_INPUT + 200);
  const parsed = parseInput(long);
  check(parsed.kind, "agent", "an overlong string is still an agent");
  check(parsed.kind === "agent" && parsed.agent.length, MAX_INPUT, "and is capped");
}

console.log(`input: ${checks} assertions passed`);
