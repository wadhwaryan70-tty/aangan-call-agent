/** @type {import('next').NextConfig} */
const nextConfig = {
  // Knowledge files are read at runtime by the webhook; make sure Vercel bundles them.
  outputFileTracingIncludes: {
    "/api/vaani/webhook": ["./knowledge/**/*"],
    "/api/eval": ["./knowledge/**/*"],
  },
};
export default nextConfig;
