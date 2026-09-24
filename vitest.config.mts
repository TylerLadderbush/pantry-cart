import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // The integration suites all hit the same single dev-mode Next.js
    // server instance, which isn't built to handle many concurrent
    // requests well (route compilation, etc.). Running test files in
    // parallel overwhelms it and causes intermittent timeouts, so keep
    // everything sequential.
    fileParallelism: false,
  },
});
