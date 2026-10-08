/**
 * Browser signals travel from the page's inline script back to the server in
 * one query parameter, so the server stays the only place that scores anything.
 *
 * The value arrives from the URL, which means it is attacker-controlled: every
 * field is range-checked and anything malformed yields null rather than a
 * half-trusted object.
 */

import type { BrowserSignals } from "@/lib/scoring";

/** Ten numeric fields, then the renderer string. */
const FIELD_COUNT = 11;
const MAX_RENDERER = 120;

export function encodeSignals(signals: BrowserSignals): string {
  return [
    signals.webdriver ? 1 : 0,
    clampInt(signals.pluginCount),
    clampInt(signals.languageCount),
    signals.hasChromeObject ? 1 : 0,
    signals.permissionMismatch ? 1 : 0,
    clampInt(signals.screenWidth),
    clampInt(signals.screenHeight),
    clampInt(signals.hardwareConcurrency),
    clampInt(signals.touchPoints),
    signals.interacted ? 1 : 0,
    toBase64Url(signals.webglRenderer.slice(0, MAX_RENDERER)),
  ].join(".");
}

export function decodeSignals(value: string | null | undefined): BrowserSignals | null {
  if (typeof value !== "string" || value === "") {
    return null;
  }

  const parts = value.split(".");

  if (parts.length !== FIELD_COUNT) {
    return null;
  }

  const numbers = parts.slice(0, 10).map(readInt);

  if (numbers.some((entry) => entry === null)) {
    return null;
  }

  const [
    webdriver,
    pluginCount,
    languageCount,
    hasChromeObject,
    permissionMismatch,
    screenWidth,
    screenHeight,
    hardwareConcurrency,
    touchPoints,
    interacted,
  ] = numbers as number[];

  if (![webdriver, hasChromeObject, permissionMismatch, interacted].every(isFlag)) {
    return null;
  }

  const renderer = fromBase64Url(parts[10]);

  if (renderer === null) {
    return null;
  }

  return {
    webdriver: webdriver === 1,
    pluginCount,
    languageCount,
    hasChromeObject: hasChromeObject === 1,
    permissionMismatch: permissionMismatch === 1,
    screenWidth,
    screenHeight,
    hardwareConcurrency,
    touchPoints,
    interacted: interacted === 1,
    webglRenderer: renderer.slice(0, MAX_RENDERER),
  };
}

function isFlag(value: number) {
  return value === 0 || value === 1;
}

/** Non-negative and bounded, so a hostile URL cannot inject a silly number. */
function clampInt(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.min(Math.round(value), 99999);
}

function readInt(value: string): number | null {
  if (!/^\d{1,5}$/.test(value)) {
    return null;
  }

  return Number.parseInt(value, 10);
}

function toBase64Url(value: string): string {
  if (value === "") {
    return "";
  }

  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string | null {
  if (value === "") {
    return "";
  }

  if (!/^[A-Za-z0-9\-_]+$/.test(value)) {
    return null;
  }

  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}
