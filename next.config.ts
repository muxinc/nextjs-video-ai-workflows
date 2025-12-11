// import { withWorkflow } from 'workflow/next';
import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname, '..'),
  }
}

// export default withWorkflow(nextConfig);
export default nextConfig;
