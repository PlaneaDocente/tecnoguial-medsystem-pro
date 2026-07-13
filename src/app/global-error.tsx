"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError] Error critico global:", error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          backgroundColor: "#f8fafc",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "24px",
          }}
        >
          <div
            style={{
              maxWidth: "420px",
              width: "100%",
              backgroundColor: "#fff",
              borderRadius: "12px",
              border: "1px solid #fecaca",
              padding: "24px",
              boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
            }}
          >
            <h2
              style={{
                color: "#dc2626",
                fontSize: "20px",
                fontWeight: "bold",
                marginBottom: "8px",
              }}
            >
              Error Critico Global
            </h2>
            <p
              style={{
                color: "#475569",
                fontSize: "14px",
                marginBottom: "16px",
                lineHeight: "1.5",
              }}
            >
              La aplicacion no pudo iniciar correctamente. Esto puede deberse a un error en el layout principal.
            </p>
            <div
              style={{
                backgroundColor: "#f1f5f9",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "16px",
                maxHeight: "120px",
                overflow: "auto",
              }}
            >
              <code
                style={{
                  color: "#dc2626",
                  fontSize: "12px",
                  wordBreak: "break-all",
                  whiteSpace: "pre-wrap",
                }}
              >
                {error?.message || "Error desconocido"}
              </code>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={reset}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  backgroundColor: "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                Reintentar
              </button>
              <a
                href="/login"
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  backgroundColor: "#e2e8f0",
                  color: "#334155",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  textDecoration: "none",
                  textAlign: "center",
                  display: "inline-block",
                }}
              >
                Ir al Login
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}