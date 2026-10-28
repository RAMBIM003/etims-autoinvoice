import type { NextConfig } from "next";

/*
 * /api/* is proxied to the Express backend by src/app/api/[...path]/route.ts,
 * which reads API_ORIGIN per request. A rewrite would bake the destination
 * into the build.
 */
const nextConfig: NextConfig = {
    output: "standalone",

    // Tailwind v4 runs as a Turbopack CSS loader; this is what create-next-app wires up.
    turbopack: {
        rules: {
            "*.css": {
                loaders: ["@tailwindcss/turbopack"],
                as: "*.css",
            },
        },
    },
};

export default nextConfig;
