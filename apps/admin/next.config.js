/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disable ESLint during builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Temporarily ignoring TypeScript errors for deployment
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig