import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    // Prevent duplicate React instances when testing components that live
    // outside packages/ui (e.g. dashboard app/(dashboard) components).
    dedupe: ["react", "react-dom"],
    alias: {
      // Resolve @/services/BillingService (dashboard alias) to a no-op mock.
      // The AutoTopUpSection/DisabledBox only import AutoTopUpState as a TYPE;
      // at runtime the module just needs to resolve without crashing.
      "@/services/BillingService": path.resolve(
        __dirname,
        "tests/__mocks__/billing-service.ts"
      ),
      // Resolve @bfeai/ui to this package's own source so imports in
      // dashboard components don't create a second React tree.
      "@bfeai/ui": path.resolve(__dirname, "src/index.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
  },
});
