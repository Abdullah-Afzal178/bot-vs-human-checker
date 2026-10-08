import { ImageResponse } from "next/og";

import { PAGE_TITLE, SITE_NAME } from "@/lib/constants";

export const alt = PAGE_TITLE;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#042f2e",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              color: "#2dd4bf",
              fontSize: "22px",
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            <div style={{ width: "12px", height: "12px", borderRadius: "999px", background: "#2dd4bf" }} />
            {SITE_NAME}
          </div>

          <div
            style={{
              marginTop: "28px",
              color: "#f0fdfa",
              fontSize: "72px",
              fontWeight: 700,
              lineHeight: 1.06,
              letterSpacing: "-0.02em",
              maxWidth: "880px",
            }}
          >
            Person, or machine?
          </div>

          <div style={{ marginTop: "22px", color: "#5eead4", fontSize: "28px", maxWidth: "840px" }}>
            Every signal that decided it, with the weight each one carried.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "14px" }}>
            {[
              { label: "User-Agent", tone: "#f43f5e" },
              { label: "Network", tone: "#fb923c" },
              { label: "Headers", tone: "#2dd4bf" },
              { label: "Browser", tone: "#34d399" },
            ].map((chip) => (
              <div
                key={chip.label}
                style={{
                  display: "flex",
                  fontSize: "24px",
                  color: chip.tone,
                  border: `1px solid ${chip.tone}55`,
                  background: `${chip.tone}18`,
                  borderRadius: "999px",
                  padding: "10px 22px",
                }}
              >
                {chip.label}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", color: "#5eead4", fontSize: "24px" }}>ipgeolocation.io</div>
        </div>
      </div>
    ),
    size,
  );
}
