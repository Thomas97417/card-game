import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_CONVEX_URL: z.url(),
    VITE_CONVEX_SITE_URL: z.url(),
  },
  // Refer to each public value explicitly so Vite does not bundle the entire env.
  runtimeEnvStrict: {
    VITE_CONVEX_URL: (import.meta as any).env.VITE_CONVEX_URL,
    VITE_CONVEX_SITE_URL: (import.meta as any).env.VITE_CONVEX_SITE_URL,
  },
  emptyStringAsUndefined: true,
});
