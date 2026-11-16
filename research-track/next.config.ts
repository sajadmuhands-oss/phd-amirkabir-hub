import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "@prisma/client",
    "@react-pdf/renderer",
    "bcryptjs",
    "bullmq",
    "ioredis",
  ],
};

export default withNextIntl(nextConfig);
