import type { NextConfig } from "next";

// Define regex patterns at the top level for better performance
const NODE_PROTOCOL_REGEX = /^node:/;

const nextConfig: NextConfig = {
  webpack: (config, { isServer, webpack }) => {
    // Handle node: protocol for built-in modules
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        NODE_PROTOCOL_REGEX,
        (resource: { request: string }) => {
          // Strip the node: prefix
          resource.request = resource.request.replace(NODE_PROTOCOL_REGEX, "");
        }
      )
    );

    // Exclude Node.js built-in modules from client-side bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        async_hooks: false,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      };
    }

    return config;
  },
};

export default nextConfig;
