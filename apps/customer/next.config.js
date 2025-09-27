/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Temporarily disable ESLint during build for PWA audit
    ignoreDuringBuilds: true
  }
};

module.exports = nextConfig;
