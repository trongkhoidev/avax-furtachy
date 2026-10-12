import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.WOLFDAO_NEXT_DIST_DIR ?? ".next",
  outputFileTracingRoot: repoRoot,
};

export default nextConfig;
