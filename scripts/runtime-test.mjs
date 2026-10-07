import assert from 'node:assert/strict';
import { Actor } from 'apify';
import { readFileSync } from 'node:fs';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { buildListUrl } from '../dist/core.js';

const agent = new MockAgent();
const manifest = JSON.parse(readFileSync(new URL('../.actor/actor.json', import.meta.url), 'utf8'));
assert.equal(manifest.defaultRunOptions.memoryMbytes, 256);
assert.equal(manifest.minMemoryMbytes, 256);
assert.equal(manifest.pricingInfo.pricingPerEvent.actorChargeEvents['restaurant-scraped'].eventPriceUsd, 0.003);
assert.equal(manifest.pricingInfo.pricingPerEvent.actorChargeEvents['apify-actor-start'].eventPriceUsd, 0.00005);
agent.disableNetConnect();
setGlobalDispatcher(agent);
const pool = agent.get('https://www.swiggy.com');
const path = (offset) => { const u = new URL(buildListUrl('Bangalore', offset, 'RELEVANCE')); return u.pathname + u.search; };
const cards = [
  { info: { id: '1', name: 'Pizza A', locality: 'HSR', cuisines: ['Pizza'] } },
  { info: { id: '2', name: 'Pizza B', locality: 'Whitefield', cuisines: ['Pizza'] } },
];
pool.intercept({ path: path(null) }).reply(200, { data: { cards, pageOffset: { nextOffset: 'next' } } });
pool.intercept({ path: path('next') }).reply(200, { data: { cards, pageOffset: { nextOffset: 'more' } } });
const rows = [];
const values = new Map();
Actor.main = async (fn) => fn();
Actor.getInput = async () => ({ cities: ['Bangalore', 'Bengaluru'], localities: ['HSR', 'Whitefield'], cuisines: [], maxResults: 10, proxyConfiguration: { useApifyProxy: false } });
Actor.pushData = async (row) => { rows.push(row); return { chargedCount: 1, eventChargeLimitReached: false }; };
Actor.setValue = async (key, value) => { values.set(key, value); };
try {
  await import('../dist/main.js');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.searchLocality), ['HSR', 'Whitefield']);
  assert.equal(values.get('OUTPUT').pagesFetched, 2);
  assert.deepEqual(values.get('OUTPUT').stopReasons, ['repeated_page']);
  agent.assertNoPendingInterceptors();
  console.log('Runtime check passed: locality OR filtering, city alias deduplication, repeated-page stop and OUTPUT summary.');
} finally { await agent.close(); }
