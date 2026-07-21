import type { NextConfig } from "next";

const TUNNEL_ORIGINS = ['*.ngrok-free.app', '*.ngrok.app', '*.ngrok.io', '*.trycloudflare.com']
const isDev = process.env.NODE_ENV !== 'production'

// Security headers applied to every response. frame-ancestors 'none' blocks
// clickjacking (the site can't be embedded in an <iframe>). A full default-src
// CSP is deferred because Next injects inline scripts that would need nonces —
// tighten that separately when ready.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
]

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
    // Server Actions reject requests whose Origin != Host (CSRF defense).
    // Tunnels (ngrok/cloudflare) send a tunnel Origin, so we allowlist them —
    // but ONLY in dev. In production this would disable CSRF protection for
    // every Server Action, since anyone can spin up a *.trycloudflare.com host.
    ...(isDev && { serverActions: { allowedOrigins: TUNNEL_ORIGINS } }),
  },
  // Dev-only: Next also blocks cross-origin dev assets/HMR by default.
  ...(isDev && { allowedDevOrigins: TUNNEL_ORIGINS }),
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
};

export default nextConfig;
