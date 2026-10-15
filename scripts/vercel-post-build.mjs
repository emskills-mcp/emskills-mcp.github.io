/**
 * Restructures TanStack Start's `dist/` output into Vercel Build Output API v3 format.
 *
 * TanStack Start always writes to dist/{client,server}/ regardless of NITRO_PRESET.
 * This script converts that to .vercel/output/ so Vercel knows what to deploy.
 *
 * .vercel/output/
 *   config.json           ← routing rules
 *   static/               ← dist/client/ (served by CDN)
 *   functions/
 *     __nitro.func/       ← dist/server/ + Node.js http wrapper
 *       .vc-config.json
 *       index.mjs         ← wraps the fetch-API handler for Vercel Node.js runtime
 *       server.js         ← TanStack/Nitro server bundle (fetch handler)
 *       assets/           ← server-side code-split chunks
 */

import { cpSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const root = process.cwd();
const dist = resolve(root, "dist");
const out = resolve(root, ".vercel/output");

if (!existsSync(join(dist, "client")) || !existsSync(join(dist, "server"))) {
  console.error("Expected dist/client and dist/server — run npm run build first.");
  process.exit(1);
}

// 1. Static files (CDN-served)
console.log("Copying static assets to .vercel/output/static ...");
mkdirSync(join(out, "static"), { recursive: true });
cpSync(join(dist, "client"), join(out, "static"), { recursive: true });

// 2. Serverless function directory
const fnDir = join(out, "functions/__nitro.func");
console.log("Copying server bundle to .vercel/output/functions/__nitro.func ...");
mkdirSync(fnDir, { recursive: true });
cpSync(join(dist, "server"), fnDir, { recursive: true });

// 3. .vc-config.json — Node.js 22 serverless, 30 s max
writeFileSync(
  join(fnDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launchingTimeout: 30,
      maxDuration: 30,
    },
    null,
    2
  )
);

// 4. index.mjs — thin adapter: Vercel (req, res) ← fetch handler
//    dist/server/server.js exports `default { async fetch(request, env, ctx) }`
writeFileSync(
  join(fnDir, "index.mjs"),
  `import server from "./server.js";

export default async function handler(req, res) {
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
  const url = new URL(req.url, \`\${proto}://\${host}\`);

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v != null) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  }

  let body = undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await new Promise((resolve) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks)));
    });
  }

  const request = new Request(url, { method: req.method, headers, body });
  const response = await server.fetch(request, process.env, {});

  res.statusCode = response.status;
  for (const [k, v] of response.headers.entries()) {
    res.setHeader(k, v);
  }
  res.end(Buffer.from(await response.arrayBuffer()));
}
`
);

// 5. config.json — immutable cache for hashed assets, fall through to function
writeFileSync(
  join(out, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [
        {
          src: "^/assets/(.+)$",
          headers: { "cache-control": "public, max-age=31536000, immutable" },
          continue: true,
        },
        { handle: "filesystem" },
        { src: "/(.*)", dest: "/__nitro" },
      ],
    },
    null,
    2
  )
);

console.log("✓ .vercel/output/ ready for deployment");
