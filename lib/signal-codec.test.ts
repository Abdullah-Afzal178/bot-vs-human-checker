import assert from "node:assert/strict";

import { decodeSignals, encodeSignals } from "@/lib/signal-codec";
import type { BrowserSignals } from "@/lib/scoring";

let checks = 0;
function check(actual: unknown, expected: unknown, message: string) {
  checks += 1;
  assert.deepEqual(actual, expected, message);
}
function truthy(value: unknown, message: string) {
  checks += 1;
  assert.ok(value, message);
}

function facts(overrides: Partial<BrowserSignals> = {}): BrowserSignals {
  return {
    webdriver: false,
    pluginCount: 3,
    languageCount: 2,
    webglRenderer: "ANGLE (NVIDIA GeForce RTX 3060 Direct3D11)",
    hasChromeObject: true,
    permissionMismatch: false,
    screenWidth: 2560,
    screenHeight: 1440,
    hardwareConcurrency: 8,
    touchPoints: 0,
    interacted: true,
    ...overrides,
  };
}

// --- round trip --------------------------------------------------------
check(decodeSignals(encodeSignals(facts())), facts(), "a full set round-trips exactly");
check(
  decodeSignals(encodeSignals(facts({ webdriver: true, interacted: false, hasChromeObject: false }))),
  facts({ webdriver: true, interacted: false, hasChromeObject: false }),
  "every boolean round-trips",
);
check(
  decodeSignals(encodeSignals(facts({ webglRenderer: "" }))),
  facts({ webglRenderer: "" }),
  "an empty renderer round-trips",
);
check(
  decodeSignals(encodeSignals(facts({ pluginCount: 0, languageCount: 0, hardwareConcurrency: 0, screenWidth: 0, screenHeight: 0 }))),
  facts({ pluginCount: 0, languageCount: 0, hardwareConcurrency: 0, screenWidth: 0, screenHeight: 0 }),
  "zeroes survive, rather than reading as absent",
);

// A renderer string full of characters that would break a naive encoding.
{
  const awkward = 'Mesa/X.org — "llvmpipe" (LLVM 15.0.6, 256 bits) & co. 日本語';
  const decoded = decodeSignals(encodeSignals(facts({ webglRenderer: awkward })));
  check(decoded?.webglRenderer, awkward, "punctuation, quotes and non-Latin text survive");
}

// --- the encoded form is URL-safe --------------------------------------
{
  const encoded = encodeSignals(facts({ webglRenderer: "ANGLE (Intel, Mesa 23.2 / x86_64)" }));
  truthy(/^[A-Za-z0-9._\-]*$/.test(encoded), "the encoded value needs no URL escaping");
  truthy(!encoded.includes("+"), "no plus sign, which a query string would eat");
  truthy(!encoded.includes("="), "no padding, which would need escaping");
  check(encodeSignals(facts()).split(".").length, 11, "the format is a fixed eleven fields");
}

// --- hostile input is rejected, not half-trusted ------------------------
check(decodeSignals(null), null, "null decodes to null");
check(decodeSignals(undefined), null, "undefined decodes to null");
check(decodeSignals(""), null, "an empty value decodes to null");
check(decodeSignals("garbage"), null, "junk decodes to null");
check(decodeSignals("1.2.3"), null, "too few fields decodes to null");
check(decodeSignals(`${encodeSignals(facts())}.extra`), null, "too many fields decodes to null");
check(decodeSignals("2.3.2.1.0.100.100.8.0.1."), null, "a boolean outside 0/1 is rejected");
check(decodeSignals("0.3.2.1.0.100.100.8.0.5."), null, "a non-flag in the interacted slot is rejected");
check(decodeSignals("-1.3.2.1.0.100.100.8.0.1."), null, "a negative number is rejected");
check(decodeSignals("0.3.2.1.0.100.100.8.0.1.!!!"), null, "a non-base64 renderer is rejected");
check(decodeSignals("1.1.1.1.1.1.1.1.1"), null, "nine fields is rejected");
check(decodeSignals("a.b.c.d.e.f.g.h.i.j.k"), null, "letters in numeric slots are rejected");
check(decodeSignals("0.999999.2.1.0.100.100.8.0.1."), null, "an absurdly long number is rejected");

// --- clamping on the way out -------------------------------------------
{
  const silly = decodeSignals(encodeSignals(facts({ pluginCount: -5, screenWidth: 1e9, hardwareConcurrency: Number.NaN })));
  check(silly?.pluginCount, 0, "a negative count encodes as zero");
  check(silly?.screenWidth, 99999, "an enormous number is capped");
  check(silly?.hardwareConcurrency, 0, "NaN encodes as zero");

  const longRenderer = decodeSignals(encodeSignals(facts({ webglRenderer: "x".repeat(400) })));
  truthy((longRenderer?.webglRenderer.length ?? 0) <= 120, "an overlong renderer string is truncated");
}

console.log(`signal-codec: ${checks} assertions passed`);
