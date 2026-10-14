import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
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
    //
    // Separately, a test that triggers a recipe search can now also
    // trigger lib/recipe-detail.ts's bulk Spoonacular backfill (fetching
    // full detail for every search result still missing it, in one
    // informationBulk call) - a real network call for up to a batch's
    // worth of recipes, which is slower than the plain search call alone.
    testTimeout: 30000,
  },
});
