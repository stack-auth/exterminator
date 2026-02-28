import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["iife"],
  globalName: "Exterminator",
  minify: true,
  sourcemap: true,
  clean: true,
});
