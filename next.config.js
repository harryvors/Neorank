/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only handle API routes, not pages
  output: 'standalone',
  experimental: {
    // Enable app directory
    appDir: true,
  },
};

module.exports = nextConfig;

