/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/backend-api/:path*',
        destination: 'http://localhost:4000/api/:path*',
      },
      {
        source: '/portal-api/:path*',
        destination: 'http://localhost:4001/api/:path*',
      },
      {
        source: '/screenshots/:path*',
        destination: 'http://localhost:4000/screenshots/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
