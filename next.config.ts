import type { NextConfig } from "next";

import { getR2ConnectSrcOrigin } from "./src/lib/r2/client";

const isDevelopment = process.env.NODE_ENV === "development";
const r2ConnectSrc = getR2ConnectSrcOrigin();

function buildContentSecurityPolicy(): string {
  const scriptSrc = isDevelopment
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net"
    : "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net";

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "font-src 'self' data: https://cdn.jsdelivr.net",
    "img-src 'self' data: blob: https:",
    "worker-src 'self' blob:",
    `connect-src 'self' https://cdn.jsdelivr.net ${r2ConnectSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://github.com",
    "frame-ancestors 'none'",
  ].join("; ");
}

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/s/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
          {
            key: "Referrer-Policy",
            value: "no-referrer",
          },
        ],
      },
      {
        // Config headers win over route handler headers, so the download route
        // must be excluded to keep its own sandbox CSP.
        source: "/((?!api/items/[^/]+/download).*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: buildContentSecurityPolicy(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
