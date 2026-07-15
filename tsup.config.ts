import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["collector/index.ts"],
  clean: true,
  format: ["esm"],
  noExternal: ["zod"],
  outDir: "dist/collector",
  platform: "node",
  target: "node22",
});
