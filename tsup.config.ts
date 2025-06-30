import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cloudflare/index.ts", "src/impl/index.ts"],
  splitting: false,
  sourcemap: true,
  clean: true,
  format: "esm",
  external: ["cloudflare:workers", "cloudflare:workflows"],
  dts: true,
});
