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
    // Some tests chain several sequential bcrypt operations (e.g. signup +
    // a password change's two internal bcrypt calls + a login). bcrypt is
    // deliberately CPU-expensive by design, and this project uses the
    // pure-JS bcryptjs rather than a native binary, so under load a single
    // hash/compare can take 1-3s - three or more chained in one test can
    // exceed the 5s default even though nothing is actually broken.
    testTimeout: 15000,
  },
});
