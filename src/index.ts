import { definePlugin, Icon, KeplerPluginMeta } from '@kepler-app/plugin-sdk';
import { registerFeatures } from './features';
import { coinflip } from './features/coinflip';
import config from '../plugin.config.json';

const features = [coinflip];
const { settings, ...registrations } = registerFeatures(features);

const metadata: KeplerPluginMeta = {
  id: config.id,
  name: config.name,
  version: config.version,
  author: config.author,
  icon: Icon.sfSymbol(config.icon),
  permissions: [],
  settings,
};

export default definePlugin({ metadata, ...registrations });
