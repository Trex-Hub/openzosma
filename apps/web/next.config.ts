import type { NextConfig } from "next"

const nextConfig: NextConfig = {
	cacheComponents: true,
	reactCompiler: true,
	...(process.env.NEXT_CONFIG_OUTPUT ? { output: process.env.NEXT_CONFIG_OUTPUT as "standalone" } : {}),
}

export default nextConfig
