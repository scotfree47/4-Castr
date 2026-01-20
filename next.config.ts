import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
  },

  // Image optimization with remotePatterns instead of domains
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ui.shadcn.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
    formats: ["image/webp", "image/avif"],
  },

  // Turbopack configuration (Next.js 16 requirement)
  turbopack: {},

  // Webpack configuration
  webpack: (config, { isServer }) => {
    // Exclude _unused, saved-unused, and .aider files from compilation
    config.module.rules.push({
      test: /\.(tsx|ts|js|jsx)$/,
      exclude: [/\/_unused\//, /\/unused\//, /\/_saved-unused\//, /\/saved-unused\//, /\.aider/],
    })

    return config
  },

  // Headers for better security and performance
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
        ],
      },
    ]
  },

  // Redirects for better SEO
  async redirects() {
    return [
      {
        source: "/home",
        destination: "/1watchlist",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
