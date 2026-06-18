import { execSync } from 'child_process';
import config from '../plugin.config.json' assert { type: 'json' };

const out = `${process.env.HOME}/Library/Application Support/Kepler/Plugins/${config.bundleName}.keplugin/manifest.json`;
execSync(`kepler-plugin manifest src/index.ts --out "${out}"`, { stdio: 'inherit' });
