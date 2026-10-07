import assert from 'node:assert/strict';
import test from 'node:test';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';
import { buildListUrl, collectRestaurants, fetchSwiggyJson, getCityLocation, matchesLocality, toRecord } from './core.js';
import { normalizeInput } from './input.js';

test('aliases use the same coordinates and unknown cities fail before a request', () => {
  assert.deepEqual(getCityLocation('Bengaluru'), getCityLocation('Bangalore'));
  assert.throws(() => getCityLocation('typo'), /Unsupported/);
  assert.match(buildListUrl('Bangalore', 'next', 'RATING'), /offset=next/);
});
test('records disclose city-center context and preserve unknown availability', () => {
  const row = toRecord({ id: '1', name: 'Cafe', costForTwo: '₹1,200 for two', sla: { slaString: '20-30 mins' } }, { cuisines: [] }, 'Bangalore', null, 1);
  assert.equal(row.priceForTwo, 1200);
  assert.equal(row.currency, 'INR');
  assert.equal(row.openClosedStatus, null);
  assert.equal(row.pureVeg, null);
  assert.equal(row.deliveryTimeText, '20-30 mins');
  assert.equal(row.locationMethod, 'city_center');
  assert.equal(row.searchCoordinates.latitude, 12.9715987);
});
test('explicit false availability is not lost', () => {
  const row = toRecord({ id: '1', name: 'Cafe', isOpen: false, veg: false }, { cuisines: [] }, 'Mumbai', null, 1);
  assert.equal(row.openClosedStatus, false);
  assert.equal(row.pureVeg, false);
});
test('candidate deduplication and locality matching', () => {
  const rows: any[] = [];
  collectRestaurants({ cards: [{ info: { id: '1', name: 'Cafe', locality: 'HSR Layout' } }, { info: { id: '1', name: 'Cafe' } }] }, rows, new Set());
  assert.equal(rows.length, 1);
  assert.equal(matchesLocality(rows[0], 'hsr'), true);
  assert.equal(matchesLocality(rows[0], 'Whitefield'), false);
});
test('reject invalid direct API inputs rather than silently producing empty data', () => {
  for (const maxResults of [NaN, 1.5, -1, 0]) assert.throws(() => normalizeInput({ cities: [], maxResults }));
  assert.throws(() => normalizeInput({ cities: [4] } as any));
  assert.throws(() => normalizeInput({ cities: [], sortBy: 'wrong' } as any));
});
test('HTTP JSON errors retry within a bounded attempt count', async () => {
  const original = getGlobalDispatcher();
  const agent = new MockAgent();
  agent.disableNetConnect();
  setGlobalDispatcher(agent);
  try {
    const pool = agent.get('https://www.swiggy.com');
    pool.intercept({ path: '/fixture' }).reply(200, 'not-json');
    pool.intercept({ path: '/fixture' }).reply(200, { data: { cards: [] } });
    assert.deepEqual(await fetchSwiggyJson('https://www.swiggy.com/fixture'), { data: { cards: [] } });
    pool.intercept({ path: '/bad' }).reply(200, {}).times(2);
    await assert.rejects(fetchSwiggyJson('https://www.swiggy.com/bad'), /recognizable/);
    agent.assertNoPendingInterceptors();
  } finally {
    setGlobalDispatcher(original);
    await agent.close();
  }
});
