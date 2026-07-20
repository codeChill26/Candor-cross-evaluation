import type { NextConfig } from "next";

const TUNNEL_ORIGINS = ['*.ngrok-free.app', '*.ngrok.app', '*.ngrok.io', '*.trycloudflare.com']

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
    // Server Actions (createTeam, createOpenRound, submitResponse…) are
    // rejected when the request Origin doesn't match the Host — which is
    // exactly what happens through a tunnel (Origin = ngrok domain). Without
    // this, "create team" silently fails through ngrok even though pages load.
    serverActions: {
      allowedOrigins: TUNNEL_ORIGINS,
    },
  },
  // Next 16 also blocks cross-origin requests to dev-only assets/endpoints by
  // default; allow the tunnel domains so HMR and dev assets load too.
  allowedDevOrigins: TUNNEL_ORIGINS,
};

export default nextConfig;
