import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

// Server routes (email sending) need non-VITE_ env vars in process.env.
// These are NOT injected into the client bundle.
Object.assign(process.env, loadEnv(process.env["NODE_ENV"] ?? "development", process.cwd(), ""));

export default defineConfig({
  environments: {
    // Bundle all node_modules into the server chunk so the Vercel function
    // is self-contained (no node_modules directory needed at runtime).
    ssr: {
      resolve: { noExternal: true },
    },
  },
  plugins: [
    tanstackStart({
      // src/server.ts is our SSR error-wrapper that delegates to the TanStack handler.
      server: { entry: "server" },
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      // React Email's htmlparser2 needs entities v4.5.0; pin every import to
      // the hoisted copy so a nested v5+ copy never wins.
      "entities/lib/decode.js": path.resolve(import.meta.dirname, "node_modules/entities/lib/decode.js"),
      "entities/lib/encode.js": path.resolve(import.meta.dirname, "node_modules/entities/lib/encode.js"),
      entities: path.resolve(import.meta.dirname, "node_modules/entities"),
    },
  },
});
