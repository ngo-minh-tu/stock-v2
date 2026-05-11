/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // msw/browser package exports declare `"node": null`, which the server
    // resolution refuses. Alias it to false on the server bundle — only the
    // client ever runs the MSW worker (see src/components/common/MswBootstrap.tsx).
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'msw/browser': false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
