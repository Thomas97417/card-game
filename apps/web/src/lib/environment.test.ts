// @vitest-environment node
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

it("bundles only the declared public environment variables", async () => {
  vi.stubEnv("VITE_CONVEX_URL", "https://environment-test.convex.cloud");
  vi.stubEnv("VITE_CONVEX_SITE_URL", "https://environment-test.convex.site");
  vi.stubEnv("VITE_UNDECLARED_TOKEN", "undeclared-environment-sentinel");
  vi.stubEnv("BETTER_AUTH_SECRET", "server-environment-sentinel");

  const bundle = JSON.stringify(
    await build({
      configFile: false,
      envDir: false,
      logLevel: "silent",
      build: {
        write: false,
        lib: {
          entry: fileURLToPath(
            new URL("../../../../packages/env/src/web.ts", import.meta.url),
          ),
          formats: ["es"],
        },
      },
    }),
  );

  // Boolean assertions keep the bundle and any injected values out of test logs.
  expect(bundle.includes("https://environment-test.convex.cloud")).toBe(true);
  expect(bundle.includes("https://environment-test.convex.site")).toBe(true);
  expect(bundle.includes("undeclared-environment-sentinel")).toBe(false);
  expect(bundle.includes("server-environment-sentinel")).toBe(false);
});
