import path from "node:path";

import { withWorkflow } from "workflow/next";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default withWorkflow(nextConfig);
