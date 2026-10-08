import { PROBE_WINDOW_MS } from "@/lib/constants";

/**
 * Reads what the browser admits about itself and hands it to the server, which
 * stays the only place that scores anything.
 *
 * This is a plain inline script rather than a client component on purpose.
 * Hydration can be deferred or skipped entirely, and a check that silently
 * never runs would report every visitor as "no JavaScript signals" — the exact
 * opposite of the truth. An inline script runs the moment it is parsed.
 *
 * Not running is itself the measurement: a crawler that ignores JavaScript
 * never reaches this, and is scored on the server signals alone.
 */
export function BrowserProbe({ query }: { query: string }) {
  const script = PROBE_SCRIPT.replace("__WINDOW__", String(PROBE_WINDOW_MS)).replace(
    "__QUERY__",
    JSON.stringify(query),
  );

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

const PROBE_SCRIPT = `(function () {
  var params = new URLSearchParams(window.location.search);

  // The guard that stops this looping: once the signals are in the URL, the
  // server has them and there is nothing left to send.
  if (params.has("js")) return;

  function renderer() {
    try {
      var canvas = document.createElement("canvas");
      var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) return "";
      var info = gl.getExtension("WEBGL_debug_renderer_info");
      return String((info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || "");
    } catch (error) { return ""; }
  }

  function b64(value) {
    if (!value) return "";
    try {
      var bytes = new TextEncoder().encode(value.slice(0, 120));
      var binary = "";
      for (var i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
      return btoa(binary).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
    } catch (error) { return ""; }
  }

  function count(value) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) return 0;
    return Math.min(Math.round(n), 99999);
  }

  var nav = navigator;
  var interacted = false;
  var mismatch = 0;
  var sent = false;

  function note() { interacted = true; }
  var events = ["pointermove", "pointerdown", "keydown", "wheel", "scroll", "touchstart"];
  events.forEach(function (name) {
    window.addEventListener(name, note, { once: true, passive: true, capture: true });
  });

  // Headless Chrome has long reported "denied" through the Permissions API
  // while Notification.permission still says "default".
  try {
    if (nav.permissions && typeof Notification !== "undefined") {
      nav.permissions.query({ name: "notifications" }).then(function (status) {
        if (status.state === "denied" && Notification.permission === "default") mismatch = 1;
      }).catch(function () {});
    }
  } catch (error) {}

  function send() {
    if (sent) return;
    sent = true;
    events.forEach(function (name) { window.removeEventListener(name, note, { capture: true }); });

    var screenWidth = count(window.screen ? window.screen.width : 0);
    var screenHeight = count(window.screen ? window.screen.height : 0);

    var encoded = [
      nav.webdriver === true ? 1 : 0,
      count(nav.plugins ? nav.plugins.length : 0),
      count(nav.languages ? nav.languages.length : 0),
      typeof window.chrome !== "undefined" ? 1 : 0,
      mismatch,
      screenWidth,
      screenHeight,
      count(nav.hardwareConcurrency),
      count(nav.maxTouchPoints),
      interacted ? 1 : 0,
      b64(renderer())
    ].join(".");

    var next = new URLSearchParams();
    var query = __QUERY__;
    if (query) next.set("q", query);
    next.set("js", encoded);

    // replace() so the signal-free URL does not sit in the back history.
    window.location.replace(window.location.pathname + "?" + next.toString());
  }

  // A short window, so someone who moves the mouse straight away gets the
  // credit for it, without making everyone else wait around.
  window.setTimeout(send, __WINDOW__);
})();`;
