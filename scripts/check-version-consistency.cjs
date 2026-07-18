const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const root = process.cwd();
const packageJsonPath = path.join(root, "package.json");
const pluginConfigPath = path.join(root, "plugin.config.json");

const packageJson = readJson(packageJsonPath);
const pluginConfig = readJson(pluginConfigPath);

const packageVersion = packageJson.version;
const pluginVersion = pluginConfig.version;

if (!packageVersion || !pluginVersion) {
  console.error("Missing version in package.json or plugin.config.json");
  process.exit(1);
}

if (packageVersion !== pluginVersion) {
  console.error(
    `Version mismatch: package.json=${packageVersion}, plugin.config.json=${pluginVersion}`,
  );
  process.exit(1);
}

const releaseTag = process.env.RELEASE_TAG;
if (releaseTag) {
  const semverTagPattern = /^v\d+\.\d+\.\d+(?:[-+].*)?$/;

  if (semverTagPattern.test(releaseTag)) {
    const tagVersion = releaseTag.slice(1);
    if (tagVersion !== packageVersion) {
      console.error(
        `Tag/version mismatch: RELEASE_TAG=${releaseTag}, expected v${packageVersion}`,
      );
      process.exit(1);
    }
  } else {
    console.log(
      `RELEASE_TAG='${releaseTag}' is not a semver tag (vX.Y.Z). Skipping tag/version check.`,
    );
  }
}

console.log(`Version check passed: ${packageVersion}`);
