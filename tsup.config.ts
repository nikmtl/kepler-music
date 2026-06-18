import { defineConfig } from "tsup";
import config from "./plugin.config.json";

const outDir = `${process.env.HOME}/Library/Application Support/Kepler/Plugins/${config.bundleName}.keplugin`;

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["iife"],
  globalName: "KeplerPlugin",
  outDir,
  outExtension: () => ({ js: ".js" }),
  dts: false,
  clean: false,
  bundle: true,
  noExternal: [/@kepler-app\/plugin-sdk/],
});
