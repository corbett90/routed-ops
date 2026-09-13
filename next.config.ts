import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Next.js defaults Server Action request bodies to 1MB, which a phone
      // camera photo blows past instantly — that's what caused the delivery
      // capture submit to fail with a server error. Raised to cover a photo
      // plus the base64-encoded signature in the same multipart submission.
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
