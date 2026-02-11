import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const isDev = process.env.NODE_ENV === "development";
const isVercelPreview = process.env.VERCEL_ENV === "preview";

// In dev, allow local Supabase; on Vercel preview, allow the toolbar
const connectSrc = [
  "'self'",
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://api.anthropic.com",
  "https://otter.ai",
  "https://*.ingest.sentry.io",
  ...(isDev ? ["http://127.0.0.1:*", "ws://127.0.0.1:*"] : []),
  ...(isVercelPreview ? ["https://vercel.live", "wss://ws-us3.pusher.com"] : []),
].join(" ");

const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  "'unsafe-eval'",
  ...(isVercelPreview ? ["https://vercel.live"] : []),
].join(" ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src ${scriptSrc}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              `connect-src ${connectSrc}`,
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Only print source map upload logs in CI
  silent: !process.env.CI,

  // No-op without SENTRY_ORG and SENTRY_PROJECT env vars
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
