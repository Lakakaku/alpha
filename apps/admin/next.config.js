/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disable ESLint during builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // We're handling TypeScript errors separately
    ignoreBuildErrors: false,
  },
}

module.exports = nextConfig