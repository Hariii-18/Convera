"use client";

import { useEffect } from "react";

/**
 * Catches errors thrown by the root layout itself (fonts, providers, etc.),
 * which `error.tsx` cannot — it only covers the segments below the root
 * layout. Deliberately self-contained (no shared components, no Tailwind
 * classes tied to globals.css) since the failure may be in the layout that
 * would normally supply them.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[global-error]", error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#0a0a0a",
          color: "#fafafa",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>
            Something went wrong
          </h1>
          <p
            style={{
              marginTop: "0.5rem",
              fontSize: "0.875rem",
              color: "#a1a1aa",
            }}
          >
            Converra hit an unexpected error while loading the app. Try
            reloading — if it keeps happening, come back later.
          </p>
          <div
            style={{
              marginTop: "1.5rem",
              display: "flex",
              gap: "0.5rem",
              justifyContent: "center",
            }}
          >
            <button
              onClick={reset}
              style={{
                height: "2rem",
                padding: "0 0.875rem",
                borderRadius: "0.5rem",
                border: "none",
                background: "#fafafa",
                color: "#0a0a0a",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
            <a
              href="/dashboard"
              style={{
                height: "2rem",
                display: "inline-flex",
                alignItems: "center",
                padding: "0 0.875rem",
                borderRadius: "0.5rem",
                border: "1px solid #3f3f46",
                color: "#fafafa",
                fontSize: "0.875rem",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Back to dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
