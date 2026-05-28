/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/auth/callback",
        destination: "/callback",
        permanent: false,
      },
      {
        source: "/auth/set-password",
        destination: "/set-password",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
