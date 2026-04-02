/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "http",  hostname: "localhost" },
      { protocol: "https", hostname: "**" },
      { protocol: "http",  hostname: "**" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
      {
        source: "/static/:path*",
        destination: "http://localhost:8000/static/:path*",
      },
    ];
  },
};

export default nextConfig;
