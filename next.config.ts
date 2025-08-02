import withPWA from "next-pwa";
import type { Configuration } from "webpack";
import type { NextConfig } from "next";

const pwa = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /\/models\/.*$/,
      handler: "CacheFirst",
      options: {
        cacheName: "model-cache",
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
  ],
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config: Configuration, { isServer }: { isServer: boolean }) => {
    if (!isServer) {
      config.output = config.output || {};
      config.output.globalObject = "self";
    }
    return config;
  },
};

export default pwa(nextConfig);
