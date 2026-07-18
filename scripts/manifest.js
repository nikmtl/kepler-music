import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const configPath = path.join(process.cwd(), "plugin.config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const out = `${process.env.HOME}/Library/Application Support/Kepler/Plugins/${config.bundleName}.keplugin/manifest.json`;
execSync(`kepler-plugin manifest src/index.ts --out "${out}"`, {
  stdio: "inherit",
});
