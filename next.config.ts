import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/(.*)", headers: SECURITY_HEADERS },
    ];
  },
  async redirects() {
    return [
      {
        source: "/this-is-my-choice",
        destination: "https://www.djandykofficial.com/this-is-my-choice",
        permanent: true,
      },
      {
        source: "/this-is-my-choice/rules",
        destination: "https://www.djandykofficial.com/this-is-my-choice/rules",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
