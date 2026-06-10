import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Twilio's SDK pulls in Node-only modules; keep it out of the edge bundle.
  serverExternalPackages: ["twilio"],
};

export default nextConfig;
