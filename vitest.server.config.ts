import { defineConfig } from "vitest/config";

// The server tier runs in Node, not jsdom, and lives outside src/ — so it
// needs its own config rather than an entry in vitest.config.ts.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["netlify/**/*.{test,spec}.{js,ts}"],
    // scrypt at OWASP parameters is deliberately slow.
    testTimeout: 30000,
  },
});
