import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeInput } from './input.js';

test('uses a one-result, India residential default', () => {
  const input = normalizeInput(null);

  assert.deepEqual(input.cities, ['Bangalore']);
  assert.deepEqual(input.cuisines, ['pizza']);
  assert.equal(input.maxResults, 1);
  assert.deepEqual(input.proxyConfiguration, {
    useApifyProxy: true,
    apifyProxyGroups: ['RESIDENTIAL'],
    apifyProxyCountry: 'IN',
  });
});

test('cleans lists, clamps result limits, and completes partial proxy input', () => {
  const input = normalizeInput({
    cities: [' Mumbai ', ''],
    localities: [' Bandra ', ' '],
    cuisines: [],
    maxResults: 999,
    proxyConfiguration: { apifyProxyCountry: 'IN' },
  });

  assert.deepEqual(input.cities, ['Mumbai']);
  assert.deepEqual(input.localities, ['Bandra']);
  assert.deepEqual(input.cuisines, []);
  assert.equal(input.maxResults, 300);
  assert.deepEqual(input.proxyConfiguration, {
    useApifyProxy: true,
    apifyProxyGroups: ['RESIDENTIAL'],
    apifyProxyCountry: 'IN',
  });
});
