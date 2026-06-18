import { Command, Confidence, Icon, LookAhead, Match, Widget } from '@kepler-app/plugin-sdk';
import { Feature } from '.';

const enum Setting {
  SEARCH = 'cf-searchmode-toggle',
  LOOKAHEAD = 'cf-lookahead-toggle',
  WIDGET = 'cf-widget-toggle',
}

function flipCoin(): 'Heads' | 'Tails' {
  return Math.random() < 0.5 ? 'Heads' : 'Tails';
}

export const coinflip: Feature = {
  settings: [
    {
      id: Setting.SEARCH,
      kind: 'toggle',
      title: 'Enable Coinflip Search Mode',
      description: 'This one should actually work!',
      defaultValue: true,
    },
    {
      id: Setting.LOOKAHEAD,
      kind: 'toggle',
      title: 'Enable Coinflip Look Ahead',
      description: 'This setting is not functional right now.',
      defaultValue: false,
    },
    {
      id: Setting.WIDGET,
      kind: 'toggle',
      title: 'Enable Coinflip Widget',
      description: 'It breaks the UI right now, so I disabled this option temporarily!',
      defaultValue: false,
    },
  ],
  searchModes: [
    Command.search({
      id: 'cf-mode',
      title: 'Coinflip',
      icon: Icon.emoji('🪙'),
      subtitle: "Feelin' lucky today?",
      keywords: ['coin', 'flip', 'coinflip'],
      shortcutPrefix: 'cf',
      async run(_query, ctx) {
        if (!ctx.settings[Setting.SEARCH]) return [];
        return [{ id: 'cf-result', title: flipCoin() }];
      },
    }),
  ],
  lookAhead: [
    LookAhead.items({
      id: 'coinflip-lookahead',
      title: 'Heads or Tails?',
      run(ctx) {
        if (!ctx.settings[Setting.LOOKAHEAD]) return [];
        const result = flipCoin();
        return [
          {
            id: 'cf-result',
            kind: 'generic',
            title: result,
            subtitle: 'We will find out!',
            icon: Icon.emoji(result === 'Heads' ? '🗣️' : '🪙'),
          },
        ];
      },
    }),
  ],
  widgets: [
    /*Widget.inline({
      id: 'coinflip',
      title: 'Flip a Coin',
      priorityBias: 0.1,
      match(query, ctx) {
        if (!ctx.settings[Setting.WIDGET]) return Match.none();
        if (query.raw.match(/coinflip/i)) return Match.exact();
        return Match.none();
      },
      run(_query, _ctx, _match) {
        const result = flipCoin();
        return {
          confidence: Confidence.exact,
          view: {
            type: 'value',
            sectionTitle: "Let's see what you've got",
            title: 'Coin Flip',
            icon: Icon.sfSymbol('hammer'),
            value: result,
          },
        };
      },
    }),*/
  ],
};
