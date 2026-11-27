import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyTransferStatus,
  extractTransferItemsFromEspnArticles,
  isTransferArticle,
  mergeAndSortTransfers,
  parseEspnTransactionsToTransfers,
} from './transfers.ts';

describe('transfers module', () => {
  const matchCtx = {
    homeId: '359',
    homeName: 'Arsenal',
    homeShortName: 'Arsenal',
    awayId: '360',
    awayName: 'Manchester United',
    awayShortName: 'Man United',
  };

  it('distinguishes official signings from transfer rumors accurately', () => {
    assert.equal(
      classifyTransferStatus('Transfer rumors, news: Nico Paz open to Man United'),
      'rumor'
    );
    assert.equal(
      classifyTransferStatus('Arsenal midfielder signs new contract extension until 2030'),
      'official'
    );
    assert.equal(
      classifyTransferStatus('Man United-linked striker signs new Leeds deal'),
      'rumor'
    );
  });

  it('filters ESPN articles to transfer stories matching home or away club', () => {
    const articles = [
      {
        id: '1',
        headline: 'Transfer rumors, news:Transfer rumors, news: Nico Paz open to Man United',
        description: 'Manchester United target Como playmaker ahead of window.',
        published: '2026-11-27T15:30:00Z',
        categories: [
          { type: 'topic', description: 'soccer transfers' },
          { type: 'team', teamId: '360', description: 'Manchester United' },
        ],
        links: { web: { href: 'https://espn.com/1' } },
      },
      {
        id: '2',
        headline: 'Arsenal vs Chelsea tactical preview',
        description: 'Lineup news ahead of weekend clash.',
        published: '2026-11-27T14:00:00Z',
        categories: [{ type: 'team', teamId: '359', description: 'Arsenal' }],
      },
      {
        id: '3',
        headline: 'Barcelona signs new defender',
        description: 'Official move in La Liga.',
        published: '2026-11-27T12:00:00Z',
        categories: [{ type: 'topic', description: 'soccer transfers' }],
      },
    ];

    assert.equal(isTransferArticle(articles[1]), false);
    const items = extractTransferItemsFromEspnArticles(articles, matchCtx);
    assert.equal(items.length, 1);
    assert.equal(items[0].clubSide, 'away');
    assert.equal(items[0].status, 'rumor');
    assert.equal(items[0].title, 'Transferts : Nico Paz open to Man United');
    assert.equal(items[0].url, 'https://espn.com/1');
  });

  it('parses official ESPN transactions and deduplicates merged lists', () => {
    const txs = parseEspnTransactionsToTransfers(
      [
        {
          id: 'tx-10',
          date: '2026-08-30T10:00:00Z',
          team: { id: '359', displayName: 'Arsenal' },
          player: { displayName: 'Mikel Merino' },
          description: 'Signed permanent transfer from Real Sociedad.',
        },
      ],
      matchCtx
    );

    assert.equal(txs.length, 1);
    assert.equal(txs[0].status, 'official');
    assert.equal(txs[0].clubSide, 'home');

    const merged = mergeAndSortTransfers([...txs, ...txs]);
    assert.equal(merged.length, 1);
  });

  it('ignores commercial supplier roundups tagged with many teams', () => {
    const noisy = [
      {
        id: 'noise-1',
        headline: 'As Nike replaces Adidas, is UEFA star ball on its way out?',
        description: 'Nike becomes the official UEFA match ball supplier.',
        published: '2026-11-18T09:00:00Z',
        categories: [
          { type: 'topic', description: 'soccer transfers' },
          { type: 'team', teamId: '359', description: 'Arsenal' },
          { type: 'team', teamId: '360', description: 'Manchester United' },
          { type: 'team', teamId: '83', description: 'Barcelona' },
          { type: 'team', teamId: '86', description: 'Real Madrid' },
        ],
      },
    ];

    assert.equal(isTransferArticle(noisy[0]), false);
    assert.equal(extractTransferItemsFromEspnArticles(noisy, matchCtx).length, 0);
  });
});
