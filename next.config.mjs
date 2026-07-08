import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {import('next').NextConfig} */
const createNextConfig = (phase) => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;

  return {
    distDir: isDev ? ".next-dev" : ".next-build",
    reactStrictMode: true,
    devIndicators: false,
    experimental: {
      devtoolSegmentExplorer: false
    }
  };
};

export default createNextConfig;
