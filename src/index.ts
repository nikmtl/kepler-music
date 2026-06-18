import { definePlugin, Icon, KeplerPluginMeta } from '@kepler-app/plugin-sdk';
import { registerFeatures } from './features';
import { music } from './features/music';
import config from '../plugin.config.json';

const features = [music];
const { settings, ...registrations } = registerFeatures(features);

const metadata: KeplerPluginMeta = {
  id: config.id,
  name: config.name,
  version: config.version,
  author: config.author,
  icon: Icon.sfSymbol(config.icon),
  permissions: ["network"],
  networkUrls: [
    "itunes.apple.com",
    "music.apple.com",
    "api.spotify.com",
    "open.spotify.com",
    "api.genius.com",
    "genius.com",
  ],
  settings,
};

export default definePlugin({ metadata, ...registrations });
